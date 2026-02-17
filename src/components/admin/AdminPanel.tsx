import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  useToast,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Badge,
  Icon,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
} from '@chakra-ui/react';
import { FiUpload, FiRefreshCw, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AnalyticsDashboard from './AnalyticsDashboard';

interface UploadStatus {
  uploading: boolean;
  processing: boolean;
  progress: number;
  message: string;
  error: string | null;
}

const AdminPanel: React.FC = () => {
  const { isAdmin, currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    uploading: false,
    processing: false,
    progress: 0,
    message: '',
    error: null,
  });
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // Redirect if not admin
  React.useEffect(() => {
    if (!isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      navigate('/');
    }
  }, [isAdmin, navigate, toast]);

  // Fetch system status on mount
  React.useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get('/api/health');
      setSystemStatus(response.data);
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Invalid File Type',
          description: 'Please select a PDF file.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      setSelectedFile(file);
      setUploadStatus({
        uploading: false,
        processing: false,
        progress: 0,
        message: '',
        error: null,
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a PDF file to upload.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setUploadStatus({
      uploading: true,
      processing: false,
      progress: 10,
      message: 'Uploading PDF file...',
      error: null,
    });

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('pdf', selectedFile);

      // Upload the PDF
      setUploadStatus(prev => ({ ...prev, progress: 30, message: 'Processing PDF...' }));
      const uploadResponse = await axios.post('/api/admin/upload-catalog', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!uploadResponse.data.success) {
        throw new Error(uploadResponse.data.error || 'Upload failed');
      }

      // Generate embeddings
      setUploadStatus(prev => ({
        ...prev,
        uploading: false,
        processing: true,
        progress: 50,
        message: 'Generating embeddings... This may take several minutes.',
      }));

      const embeddingsResponse = await axios.post('/api/admin/regenerate-embeddings');

      if (!embeddingsResponse.data.success) {
        throw new Error(embeddingsResponse.data.error || 'Embeddings generation failed');
      }

      setUploadStatus({
        uploading: false,
        processing: false,
        progress: 100,
        message: 'Course catalog updated successfully!',
        error: null,
      });

      toast({
        title: 'Success',
        description: `Course catalog updated with ${embeddingsResponse.data.vectorCount} embeddings.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh system status
      await fetchSystemStatus();

      // Clear selected file
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Error uploading catalog:', error);
      setUploadStatus({
        uploading: false,
        processing: false,
        progress: 0,
        message: '',
        error: error.response?.data?.details || error.message || 'Failed to upload catalog',
      });

      toast({
        title: 'Upload Failed',
        description: error.response?.data?.details || error.message || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleClearCache = async () => {
    try {
      const response = await axios.post('/api/admin/clear-cache');
      toast({
        title: 'Cache Cleared',
        description: `Cleared ${response.data.clearedEntries} cached embeddings.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await fetchSystemStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to clear cache',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Admin Panel</Heading>
          <Text color="gray.600">
            Manage course catalog and system settings
          </Text>
        </Box>

        {/* System Status Card */}
        <Card>
          <CardHeader>
            <Heading size="md">System Status</Heading>
          </CardHeader>
          <CardBody>
            {systemStatus ? (
              <VStack align="stretch" spacing={3}>
                <HStack justify="space-between">
                  <Text>Status:</Text>
                  <Badge colorScheme="green">
                    <HStack spacing={1}>
                      <Icon as={FiCheckCircle} />
                      <Text>{systemStatus.status.toUpperCase()}</Text>
                    </HStack>
                  </Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text>PDF Content Loaded:</Text>
                  <Badge colorScheme={systemStatus.hasPdfContent ? 'green' : 'red'}>
                    {systemStatus.hasPdfContent ? 'Yes' : 'No'}
                  </Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text>Vector Search Available:</Text>
                  <Badge colorScheme={systemStatus.hasVectorSearch ? 'green' : 'red'}>
                    {systemStatus.hasVectorSearch ? 'Yes' : 'No'}
                  </Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text>Vector Count:</Text>
                  <Badge colorScheme="blue">{systemStatus.vectorCount}</Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text>Content Length:</Text>
                  <Badge colorScheme="purple">
                    {systemStatus.contentLength.toLocaleString()} chars
                  </Badge>
                </HStack>
              </VStack>
            ) : (
              <Text color="gray.500">Loading system status...</Text>
            )}
          </CardBody>
        </Card>

        <Divider />

        {/* Upload New Catalog Card */}
        <Card>
          <CardHeader>
            <Heading size="md">Upload New Course Catalog</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Select PDF File</FormLabel>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  disabled={uploadStatus.uploading || uploadStatus.processing}
                  p={1}
                />
                <FormHelperText>
                  Upload a new course catalog PDF. This will replace the current catalog and regenerate all embeddings.
                </FormHelperText>
              </FormControl>

              {selectedFile && (
                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>File Selected</AlertTitle>
                    <AlertDescription>
                      {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {uploadStatus.error && (
                <Alert status="error">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{uploadStatus.error}</AlertDescription>
                  </Box>
                </Alert>
              )}

              {(uploadStatus.uploading || uploadStatus.processing) && (
                <Box>
                  <Text mb={2} fontSize="sm" color="gray.600">
                    {uploadStatus.message}
                  </Text>
                  <Progress
                    value={uploadStatus.progress}
                    size="sm"
                    colorScheme="blue"
                    isIndeterminate={uploadStatus.processing}
                  />
                </Box>
              )}

              {uploadStatus.progress === 100 && !uploadStatus.error && (
                <Alert status="success">
                  <AlertIcon as={FiCheckCircle} />
                  <Box>
                    <AlertTitle>Success!</AlertTitle>
                    <AlertDescription>{uploadStatus.message}</AlertDescription>
                  </Box>
                </Alert>
              )}

              <HStack spacing={3}>
                <Button
                  leftIcon={<FiUpload />}
                  colorScheme="blue"
                  onClick={handleUpload}
                  isDisabled={!selectedFile || uploadStatus.uploading || uploadStatus.processing}
                  isLoading={uploadStatus.uploading || uploadStatus.processing}
                  loadingText={uploadStatus.uploading ? 'Uploading...' : 'Processing...'}
                >
                  Upload and Process
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadStatus({
                      uploading: false,
                      processing: false,
                      progress: 0,
                      message: '',
                      error: null,
                    });
                  }}
                  isDisabled={uploadStatus.uploading || uploadStatus.processing}
                >
                  Clear
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        <Divider />

        {/* Cache Management Card */}
        <Card>
          <CardHeader>
            <Heading size="md">Cache Management</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Text color="gray.600">
                Clear the embeddings cache to force regeneration of all embeddings on the next request.
                This can be useful if you're experiencing issues with search results.
              </Text>
              <Button
                leftIcon={<FiRefreshCw />}
                colorScheme="orange"
                variant="outline"
                onClick={handleClearCache}
              >
                Clear Embeddings Cache
              </Button>
            </VStack>
          </CardBody>
        </Card>

        <Divider />

        {/* Usage Analytics Dashboard */}
        <AnalyticsDashboard />
      </VStack>
    </Container>
  );
};

export default AdminPanel;
