import React from 'react';
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  Button, 
  VStack, 
  Flex, 
  HStack, 
  useColorModeValue,
  Badge
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './chat/ChatInterface';
import PDFViewer from './PDFViewer';

const Home: React.FC = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const bgGradient = useColorModeValue(
    'linear(to-r, brand.600, brand.700)',
    'linear(to-r, brand.500, brand.600)'
  );
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box 
        py={4} 
        bgGradient={bgGradient} 
        color="white" 
        boxShadow="md"
      >
        <Container maxW="container.lg">
          <Flex align="center" justify="space-between">
            <Heading size="lg" fontWeight="bold">
              Del Norte Course Selector
            </Heading>
            
            <HStack spacing={4}>
              <Text fontWeight="medium">
                {currentUser?.email}
              </Text>
              {isAdmin && (
                <Button 
                  onClick={() => navigate('/admin')} 
                  colorScheme="whiteAlpha" 
                  variant="solid"
                  _hover={{ bg: 'whiteAlpha.300' }}
                  size="sm"
                >
                  Admin Panel
                </Button>
              )}
              <Button 
                onClick={handleLogout} 
                colorScheme="whiteAlpha" 
                variant="outline"
                _hover={{ bg: 'whiteAlpha.200' }}
                size="sm"
              >
                Sign Out
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.lg" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Welcome Section */}
          <Box 
            p={6} 
            borderRadius="xl" 
            bg={cardBg} 
            boxShadow="md" 
            borderWidth={1}
            borderColor={borderColor}
          >
            <Flex align="center" justify="space-between" wrap="wrap">
              <Box mb={{ base: 4, md: 0 }}>
                <Heading size="md" mb={2} color="brand.700">
                  Welcome to Your Course Selection Assistant
                </Heading>
                <Text color="gray.600">
                  Ask questions about courses, requirements, and get personalized recommendations
                </Text>
              </Box>
              
              <HStack spacing={4}>
                <Badge colorScheme="accent" p={2} borderRadius="md" fontSize="sm">
                  2026-2027 Catalog
                </Badge>
                <PDFViewer pdfUrl="/api/pdf" />
              </HStack>
            </Flex>
          </Box>

          {/* Chat Interface */}
          <ChatInterface />
        </VStack>
      </Container>
    </Box>
  );
};

export default Home;
