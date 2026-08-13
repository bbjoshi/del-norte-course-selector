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
  Link,
  IconButton,
  Tooltip,
  useColorModeValue,
  useColorMode,
  Badge
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './chat/ChatInterface';
import PDFViewer from './PDFViewer';

const Home: React.FC = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();
  const pageBg = useColorModeValue('gray.50', 'gray.900');
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
    <Box minH="100vh" bg={pageBg}>
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
            
            <HStack spacing={3}>
              <Text fontWeight="medium" fontSize="sm">
                {currentUser?.email}
              </Text>
              <Tooltip label={colorMode === 'light' ? 'Dark mode' : 'Light mode'} placement="bottom" hasArrow>
                <IconButton
                  aria-label="Toggle color mode"
                  icon={<span style={{ fontSize: '16px' }}>{colorMode === 'light' ? '🌙' : '☀️'}</span>}
                  size="sm"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.200' }}
                  onClick={toggleColorMode}
                />
              </Tooltip>
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

          {/* Footer */}
          <Text fontSize="xs" color="gray.400" textAlign="center" pb={2}>
            Developed by{' '}
            <Link
              href="https://rudrabjoshi.github.io/student/"
              isExternal
              fontWeight="semibold"
              color="brand.600"
              _hover={{ color: 'brand.500', textDecoration: 'underline' }}
            >
              Rudra Joshi
            </Link>
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default Home;
