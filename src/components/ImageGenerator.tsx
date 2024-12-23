import React, { useState, useEffect } from 'react';
import axios, { AxiosResponse } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Download, Copy, Image as ImageIcon, Wand2, Sparkles, Plus } from 'lucide-react';

interface GeneratedImage {
  timestamp: string;
  prompt: string;
  data: Array<{
    url: string;
    revised_prompt?: string;
  }>;
}

interface PromptSuggestions {
  categories: Array<{
    name: string;
    prompts: string[];
  }>;
  modifiers: string[];
}

interface ImageResponse {
  images: GeneratedImage[];
}

interface EditResponse {
  edits: GeneratedImage[];
}

interface SuggestionResponse {
  categories: {
    name: string;
    prompts: string[];
  }[];
  modifiers: string[];
}

interface VariationResponse {
  images: GeneratedImage[];
}

export function ImageGenerator() {
  const [activeTab, setActiveTab] = useState('generate');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('dall-e-3');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [imageEdits, setImageEdits] = useState<GeneratedImage[]>([]);
  const [variations, setVariations] = useState<GeneratedImage[]>([]);
  const [suggestions, setSuggestions] = useState<PromptSuggestions | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedMask, setSelectedMask] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [maskPreview, setMaskPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
    fetchEdits();
    fetchVariations();
    fetchSuggestions();
  }, []);

  const fetchImages = async () => {
    try {
      const response: AxiosResponse<ImageResponse> = await axios.get('http://localhost:3001/api/images');
      setGeneratedImages(response.data.images);
    } catch (error: unknown) {
      console.error('Error fetching images:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to fetch images');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to fetch images');
      }
    }
  };

  const fetchEdits = async () => {
    try {
      const response: AxiosResponse<EditResponse> = await axios.get('http://localhost:3001/api/image-edits');
      setImageEdits(response.data.edits);
    } catch (error: unknown) {
      console.error('Error fetching edits:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to fetch edits');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to fetch edits');
      }
    }
  };

  const fetchVariations = async () => {
    try {
      const response: AxiosResponse<VariationResponse> = await axios.get('http://localhost:3001/api/image-variations');
      setVariations(response.data.images);
    } catch (error: unknown) {
      console.error('Error fetching variations:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to fetch variations');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to fetch variations');
      }
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response: AxiosResponse<SuggestionResponse> = await axios.get('http://localhost:3001/api/prompt-suggestions');
      setSuggestions(response.data);
    } catch (error: unknown) {
      console.error('Error fetching suggestions:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to fetch suggestions');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to fetch suggestions');
      }
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMaskSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMask(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMaskPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      const response: AxiosResponse<ImageResponse> = await axios.post('http://localhost:3001/api/generate', formData);
      setGeneratedImages([...generatedImages, response.data.images[0]]);
      setPrompt('');
    } catch (error: unknown) {
      console.error('Error generating image:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to generate image');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to generate image');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedImage) {
      setError('Please select an image to edit');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedImage);
    if (selectedMask) {
      formData.append('mask', selectedMask);
    }
    formData.append('prompt', prompt);

    try {
      const response: AxiosResponse<ImageResponse> = await axios.post('http://localhost:3001/api/edit', formData);
      setImageEdits([...imageEdits, response.data.images[0]]);
      setPrompt('');
      setSelectedImage(null);
      setSelectedMask(null);
      setImagePreview(null);
      setMaskPreview(null);
    } catch (error: unknown) {
      console.error('Error editing image:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to edit image');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to edit image');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVariation = async () => {
    if (!selectedImage) {
      setError('Please select an image');
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response: AxiosResponse<VariationResponse> = await axios.post('http://localhost:3001/api/variations', formData);
      setVariations([...variations, ...response.data.images]);
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error: unknown) {
      console.error('Error creating variations:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to create variations');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to create variations');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: unknown) {
      console.error('Error downloading image:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || error.message || 'Failed to download image');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to download image');
      }
    }
  };

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
  };

  const addPromptSuggestion = (suggestion: string) => {
    setPrompt(prev => {
      const newPrompt = prev.trim() ? `${prev}, ${suggestion}` : suggestion;
      return newPrompt;
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">
            <Wand2 className="w-4 h-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="edit">
            <ImageIcon className="w-4 h-4 mr-2" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="variations">
            <Sparkles className="w-4 h-4 mr-2" />
            Variations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Textarea
                placeholder="Enter your image prompt..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Suggestions
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Prompt Suggestions</DialogTitle>
                    <DialogDescription>
                      Click to add these suggestions to your prompt
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {suggestions?.categories.map((category) => (
                      <div key={category.name}>
                        <h3 className="font-medium mb-2">{category.name}</h3>
                        <div className="flex flex-wrap gap-2">
                          {category.prompts.map((suggestion) => (
                            <Button
                              key={suggestion}
                              variant="outline"
                              size="sm"
                              onClick={() => addPromptSuggestion(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div>
                      <h3 className="font-medium mb-2">Modifiers</h3>
                      <div className="flex flex-wrap gap-2">
                        {suggestions?.modifiers.map((modifier) => (
                          <Button
                            key={modifier}
                            variant="outline"
                            size="sm"
                            onClick={() => addPromptSuggestion(modifier)}
                          >
                            {modifier}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                  <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                </SelectContent>
              </Select>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1024">1024x1024</SelectItem>
                  <SelectItem value="1792x1024">1792x1024</SelectItem>
                  <SelectItem value="1024x1792">1024x1792</SelectItem>
                </SelectContent>
              </Select>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="hd">HD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Image'
              )}
            </Button>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold">Generated Images</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedImages.map((image) => (
                <Card key={image.timestamp}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      {new Date(image.timestamp).toLocaleString()}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {image.prompt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {image.data.map((item) => (
                      <div className="space-y-4">
                        <img
                          src={item.url}
                          alt={`Generated image`}
                          className="w-full rounded-lg shadow-lg"
                        />
                        {item.revised_prompt && (
                          <p className="text-sm text-gray-500">
                            Revised: {item.revised_prompt}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleCopyPrompt(image.prompt)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy prompt</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDownload(image.data[0].url)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download image</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="edit" className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Source Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="mt-2"
                />
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Selected image"
                    className="mt-2 rounded-lg"
                  />
                )}
              </div>
              <div>
                <Label>Mask Image (Optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleMaskSelect}
                  className="mt-2"
                />
                {maskPreview && (
                  <img
                    src={maskPreview}
                    alt="Selected mask"
                    className="mt-2 rounded-lg"
                  />
                )}
              </div>
            </div>
            <Textarea
              placeholder="Enter your edit prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <Button
              onClick={handleEdit}
              disabled={isLoading || !selectedImage || !prompt.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Editing...
                </>
              ) : (
                'Edit Image'
              )}
            </Button>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold">Edited Images</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {imageEdits.map((edit) => (
                <Card key={edit.timestamp}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      {new Date(edit.timestamp).toLocaleString()}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {edit.prompt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {edit.data.map((item) => (
                      <div className="space-y-4">
                        <img
                          src={item.url}
                          alt={`Edited image`}
                          className="w-full rounded-lg shadow-lg"
                        />
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyPrompt(edit.prompt)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDownload(edit.data[0].url)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="variations" className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Source Image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="mt-2"
              />
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Selected image"
                  className="mt-2 rounded-lg"
                />
              )}
            </div>
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <Button
              onClick={handleCreateVariation}
              disabled={isLoading || !selectedImage}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Variations...
                </>
              ) : (
                'Create Variations'
              )}
            </Button>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold">Image Variations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {variations.map((variation) => (
                <Card key={variation.timestamp}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      {new Date(variation.timestamp).toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    {variation.data.map((item) => (
                      <div>
                        <img
                          src={item.url}
                          alt={`Variation`}
                          className="w-full rounded-lg shadow-lg"
                        />
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDownload(variation.data[0].url)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
