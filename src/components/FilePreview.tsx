import { useState, useEffect, useCallback } from 'react';
import { Editor, useMonaco } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactDiffViewer from 'react-diff-viewer-continued';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Upload, RefreshCw, FileText, Table2 } from 'lucide-react';

interface PreviewData {
  prompt: string;
  completion: string;
  lineNumber: number;
  raw: string;
}

interface FilePreviewProps {
  file: File;
  maxPreviewLines?: number;
  onFileContentChange?: (content: string) => void;
}

type ExportFormat = 'jsonl' | 'csv' | 'excel' | 'txt';

type ViewMode = 'table' | 'raw' | 'editor' | 'diff';

export function FilePreview({ file, maxPreviewLines = 5, onFileContentChange }: FilePreviewProps) {
  const monaco = useMonaco();
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [filteredData, setFilteredData] = useState<PreviewData[]>([]);
  const [totalLines, setTotalLines] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [displayLines, setDisplayLines] = useState(maxPreviewLines);
  const [rawContent, setRawContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [findWidgetOpen, setFindWidgetOpen] = useState(false);

  // Previous content for diff view
  const [previousContent, setPreviousContent] = useState('');

  useEffect(() => {
    if (monaco) {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [],
      });
    }
  }, [monaco]);

  const readFileContent = () => {
    setIsLoading(true);
    setError(null);
    const preview: PreviewData[] = [];

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        setRawContent(text);
        setEditedContent(text);
        setPreviousContent(text);
        
        const lines = text.split('\n').filter(line => line.trim());
        setTotalLines(lines.length);

        for (let i = 0; i < Math.min(lines.length, displayLines); i++) {
          try {
            const parsed = JSON.parse(lines[i]);
            preview.push({
              prompt: parsed.prompt,
              completion: parsed.completion,
              lineNumber: i + 1,
              raw: lines[i]
            });
          } catch {
            preview.push({
              prompt: 'Invalid JSON',
              completion: 'Invalid JSON',
              lineNumber: i + 1,
              raw: lines[i]
            });
          }
        }

        setPreviewData(preview);
        setFilteredData(preview);
      } catch  {
        setError('Failed to parse file content');
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditedContent(value);
      onFileContentChange?.(value);
    }
  };

  const handleSave = () => {
    setPreviousContent(editedContent);
    setIsEditing(false);
    onFileContentChange?.(editedContent);
  };

  const handleExport = (format: ExportFormat) => {
    const content = editedContent || rawContent;
    let blob: Blob;
    let filename = `edited_${file.name.split('.')[0]}`;

    switch (format) {
      case 'jsonl':
        blob = new Blob([content], { type: 'application/jsonl' });
        filename += '.jsonl';
        break;

      case 'csv': {
        const csvRows = content.split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              const { prompt, completion } = JSON.parse(line);
              return { prompt, completion };
            } catch {
              return { prompt: 'Invalid JSON', completion: 'Invalid JSON' };
            }
          });
        const csv = Papa.unparse(csvRows);
        blob = new Blob([csv], { type: 'text/csv' });
        filename += '.csv';
        break;
      }

      case 'excel': {
        const rows = content.split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              const { prompt, completion } = JSON.parse(line);
              return { Prompt: prompt, Completion: completion };
            } catch {
              return { Prompt: 'Invalid JSON', Completion: 'Invalid JSON' };
            }
          });
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename += '.xlsx';
        break;
      }

      case 'txt':
        blob = new Blob([content], { type: 'text/plain' });
        filename += '.txt';
        break;

      default:
        return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredData(previewData);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const filtered = previewData.filter(item => 
      item.prompt.toLowerCase().includes(lowercaseQuery) ||
      item.completion.toLowerCase().includes(lowercaseQuery) ||
      item.raw.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredData(filtered);
  }, [previewData]);

  const toggleFindWidget = () => {
    if (!monaco || viewMode !== 'editor') return;
    
    const models = monaco.editor.getModels();
    const editors = monaco.editor.getEditors();
    
    if (models.length === 0 || editors.length === 0) return;
    
    const editorInstance = editors[0];
    
    setFindWidgetOpen(!findWidgetOpen);
    if (!findWidgetOpen) {
      editorInstance.getAction('actions.find')?.run();
    } else {
      editorInstance.getAction('closeMarkFindWidget')?.run();
    }
  };

  return (
    <Dialog onOpenChange={(open) => {
      if (open) {
        readFileContent();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          Preview File
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>File Preview: {file.name}</span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-64"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFindWidget}
                  disabled={viewMode !== 'editor'}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select
                value={displayLines.toString()}
                onValueChange={(value) => setDisplayLines(parseInt(value))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Lines to display" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 lines</SelectItem>
                  <SelectItem value="10">10 lines</SelectItem>
                  <SelectItem value="50">50 lines</SelectItem>
                  <SelectItem value="100">100 lines</SelectItem>
                  <SelectItem value="1000">All lines</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport('jsonl')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as JSONL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <Table2 className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('excel')}>
                    <Table2 className="h-4 w-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('txt')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as TXT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4">{error}</div>
        ) : (
          <div className="mt-4">
            <Tabs defaultValue="table" className="w-full" onValueChange={(value) => setViewMode(value as ViewMode)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="raw">Raw View</TabsTrigger>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="diff">Diff View</TabsTrigger>
              </TabsList>

              <TabsContent value="table" className="border rounded-lg p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Line</TableHead>
                      <TableHead className="w-1/2">Prompt</TableHead>
                      <TableHead className="w-1/2">Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((row) => (
                      <TableRow key={row.lineNumber}>
                        <TableCell className="font-mono">{row.lineNumber}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.prompt.length > 100
                            ? `${row.prompt.substring(0, 100)}...`
                            : row.prompt}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.completion.length > 100
                            ? `${row.completion.substring(0, 100)}...`
                            : row.completion}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="raw" className="border rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {rawContent}
                </pre>
              </TabsContent>

              <TabsContent value="editor" className="border rounded-lg">
                <div className="h-[60vh]">
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    value={editedContent}
                    onChange={handleEditorChange}
                    options={{
                      minimap: { enabled: false },
                      lineNumbers: "on",
                      roundedSelection: false,
                      scrollBeyondLastLine: false,
                      readOnly: !isEditing,
                      wordWrap: "on",
                      find: {
                        addExtraSpaceOnTop: false,
                        autoFindInSelection: "always",
                        seedSearchStringFromSelection: "always"
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        const lines = editedContent.split('\n');
                        const formattedLines = lines.map(line => {
                          try {
                            const parsed = JSON.parse(line);
                            return JSON.stringify(parsed);
                          } catch {
                            return line;
                          }
                        });
                        const formatted = formattedLines.join('\n');
                        setEditedContent(formatted);
                        onFileContentChange?.(formatted);
                      } catch {
                        setError('Failed to format JSON');
                      }
                    }}
                    disabled={!isEditing}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Format JSON
                  </Button>
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditedContent(rawContent);
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>
                        <Upload className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)}>
                      Edit Content
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="diff" className="border rounded-lg p-4">
                <div className="h-[60vh] overflow-auto">
                  <ReactDiffViewer
                    oldValue={previousContent}
                    newValue={editedContent}
                    splitView={true}
                    useDarkTheme={false}
                    showDiffOnly={false}
                    hideLineNumbers={false}
                    extraLinesSurroundingDiff={3}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 text-sm text-gray-500 text-center">
              {searchQuery ? (
                <span>Found {filteredData.length} matching entries</span>
              ) : totalLines > displayLines ? (
                <span>{totalLines - displayLines} more lines not shown</span>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
