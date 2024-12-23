const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== '.jsonl') {
      return cb(new Error('Only .jsonl files are allowed for fine-tuning'));
    }
    cb(null, true);
  }
});

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const imageUpload = multer({ 
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'));
    }
  }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// JSONL Validation Function
async function validateJSONL(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  const errors = [];

  for await (const line of rl) {
    lineNumber++;
    try {
      const parsed = JSON.parse(line);
      
      // Validate required fields for fine-tuning
      if (!parsed.prompt || typeof parsed.prompt !== 'string') {
        errors.push(`Line ${lineNumber}: Missing or invalid 'prompt' field`);
      }
      if (!parsed.completion || typeof parsed.completion !== 'string') {
        errors.push(`Line ${lineNumber}: Missing or invalid 'completion' field`);
      }
      
      // Validate field lengths
      if (parsed.prompt && parsed.prompt.length > 4096) {
        errors.push(`Line ${lineNumber}: Prompt exceeds maximum length of 4096 characters`);
      }
      if (parsed.completion && parsed.completion.length > 4096) {
        errors.push(`Line ${lineNumber}: Completion exceeds maximum length of 4096 characters`);
      }
    } catch (error) {
      errors.push(`Line ${lineNumber}: Invalid JSON format - ${error.message}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalLines: lineNumber
  };
}

// Middleware
app.use(express.json());
app.use(cors());

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Validate JSONL endpoint
app.post('/api/validate-jsonl', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const validationResult = await validateJSONL(req.file.path);
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid JSONL format',
        details: validationResult.errors,
        totalLines: validationResult.totalLines
      });
    }

    res.json({
      message: 'File validation successful',
      totalLines: validationResult.totalLines
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

// File upload endpoint for OpenAI with progress tracking
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate JSONL format first
    const validationResult = await validateJSONL(req.file.path);
    if (!validationResult.isValid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Invalid JSONL format',
        details: validationResult.errors
      });
    }

    const file = await openai.files.create({
      file: fs.createReadStream(req.file.path),
      purpose: req.body.purpose || 'fine-tune',
    });

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'File uploaded successfully',
      file: {
        id: file.id,
        purpose: file.purpose,
        filename: file.filename,
        bytes: file.bytes,
        created_at: file.created_at,
        status: file.status,
        totalLines: validationResult.totalLines
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Error uploading file to OpenAI:', error);
    res.status(500).json({
      error: 'Failed to upload file',
      message: error.message
    });
  }
});

// List files endpoint
app.get('/api/files', async (req, res) => {
  try {
    const files = await openai.files.list();
    res.json(files.data);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: error.message
    });
  }
});

// Delete file endpoint
app.delete('/api/files/:fileId', async (req, res) => {
  try {
    const deletion = await openai.files.del(req.params.fileId);
    res.json({
      message: 'File deleted successfully',
      deleted: deletion.deleted,
      id: deletion.id
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      message: error.message
    });
  }
});

// OpenAI streaming endpoint
app.post('/api/generate/stream', async (req, res) => {
  try {
    const { 
      prompt,
      model = 'gpt-4-o-mini',
      temperature = 0.7,
      presence_penalty = 0,
      max_tokens = 150
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      presence_penalty,
      max_tokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: error.message 
    });
  }
});

// OpenAI non-streaming endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { 
      prompt,
      model = 'gpt-4-o-mini',
      temperature = 0.7,
      presence_penalty = 0,
      max_tokens = 150
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      presence_penalty,
      max_tokens,
    });

    res.json({ 
      result: completion.choices[0].message.content,
      usage: completion.usage
    });
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: error.message 
    });
  }
});

// DALL-E image generation endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, model = 'dall-e-3', size = '1024x1024', quality = 'standard', n = 1 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await openai.images.generate({
      model,
      prompt,
      n,
      size,
      quality,
      response_format: 'url'
    });

    // Save the generated image URLs and prompts for reference
    const imageData = {
      timestamp: new Date().toISOString(),
      prompt,
      ...response
    };

    const imageLogPath = path.join(__dirname, 'image_generations.jsonl');
    fs.appendFileSync(imageLogPath, JSON.stringify(imageData) + '\n');

    res.json(response);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      error: 'Failed to generate image',
      details: error.message
    });
  }
});

// Get list of generated images
app.get('/api/images', (req, res) => {
  try {
    const imageLogPath = path.join(__dirname, 'image_generations.jsonl');
    if (!fs.existsSync(imageLogPath)) {
      return res.json({ images: [] });
    }

    const images = fs
      .readFileSync(imageLogPath, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .reverse(); // Most recent first

    res.json({ images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      error: 'Failed to fetch images',
      details: error.message
    });
  }
});

// Edit image endpoint
app.post('/api/edit-image', imageUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mask', maxCount: 1 }
]), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!req.files?.image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const image = fs.createReadStream(req.files.image[0].path);
    const mask = req.files.mask ? fs.createReadStream(req.files.mask[0].path) : undefined;

    const response = await openai.images.edit({
      image,
      mask,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url'
    });

    // Save edit history
    const editData = {
      timestamp: new Date().toISOString(),
      prompt,
      originalImage: req.files.image[0].filename,
      mask: req.files.mask?.[0].filename,
      ...response
    };

    const editLogPath = path.join(__dirname, 'image_edits.jsonl');
    fs.appendFileSync(editLogPath, JSON.stringify(editData) + '\n');

    // Cleanup uploaded files
    fs.unlinkSync(req.files.image[0].path);
    if (req.files.mask) {
      fs.unlinkSync(req.files.mask[0].path);
    }

    res.json(response);
  } catch (error) {
    console.error('Error editing image:', error);
    res.status(500).json({
      error: 'Failed to edit image',
      details: error.message
    });
  }
});

// Generate image variations endpoint
app.post('/api/image-variations', imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const image = fs.createReadStream(req.file.path);

    const response = await openai.images.createVariation({
      image,
      n: 4,
      size: '1024x1024',
      response_format: 'url'
    });

    // Save variation history
    const variationData = {
      timestamp: new Date().toISOString(),
      originalImage: req.file.filename,
      ...response
    };

    const variationLogPath = path.join(__dirname, 'image_variations.jsonl');
    fs.appendFileSync(variationLogPath, JSON.stringify(variationData) + '\n');

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    res.json(response);
  } catch (error) {
    console.error('Error generating variations:', error);
    res.status(500).json({
      error: 'Failed to generate variations',
      details: error.message
    });
  }
});

// Get prompt suggestions
app.get('/api/prompt-suggestions', (req, res) => {
  const suggestions = {
    categories: [
      {
        name: 'Art Styles',
        prompts: [
          'in the style of Van Gogh\'s Starry Night',
          'minimalist geometric art',
          'watercolor painting',
          'pixel art',
          'art nouveau style'
        ]
      },
      {
        name: 'Photography',
        prompts: [
          'cinematic lighting',
          'aerial view',
          'macro photography',
          'golden hour lighting',
          'black and white portrait'
        ]
      },
      {
        name: 'Fantasy',
        prompts: [
          'magical forest with glowing mushrooms',
          'steampunk city',
          'floating islands in the sky',
          'crystal cave with bioluminescent plants',
          'underwater city with merfolk'
        ]
      },
      {
        name: 'Sci-Fi',
        prompts: [
          'cyberpunk cityscape',
          'retro-futuristic',
          'space colony on Mars',
          'alien marketplace',
          'holographic interface'
        ]
      }
    ],
    modifiers: [
      'highly detailed',
      'professional photography',
      '8k resolution',
      'dramatic lighting',
      'photorealistic',
      'concept art',
      'trending on artstation',
      'volumetric lighting',
      'depth of field',
      'bokeh effect'
    ]
  };

  res.json(suggestions);
});

// Get edit history
app.get('/api/image-edits', (req, res) => {
  try {
    const editLogPath = path.join(__dirname, 'image_edits.jsonl');
    if (!fs.existsSync(editLogPath)) {
      return res.json({ edits: [] });
    }

    const edits = fs
      .readFileSync(editLogPath, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .reverse();

    res.json({ edits });
  } catch (error) {
    console.error('Error fetching image edits:', error);
    res.status(500).json({
      error: 'Failed to fetch image edits',
      details: error.message
    });
  }
});

// Get variation history
app.get('/api/image-variations', (req, res) => {
  try {
    const variationLogPath = path.join(__dirname, 'image_variations.jsonl');
    if (!fs.existsSync(variationLogPath)) {
      return res.json({ variations: [] });
    }

    const variations = fs
      .readFileSync(variationLogPath, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .reverse();

    res.json({ variations });
  } catch (error) {
    console.error('Error fetching variations:', error);
    res.status(500).json({
      error: 'Failed to fetch variations',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    message: err.message
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
