import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { FirebaseError } from '@firebase/app';
import { EmailIcon, LockIcon } from '@chakra-ui/icons';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let errorMessage = 'Failed to log in';
      
      if (firebaseError.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (firebaseError.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex 
      minHeight="100vh" 
      width="full" 
      align="center" 
      justifyContent="center"
      bg="gray.50"
    >
      <Container maxW="md" py={12} px={6}>
        <VStack spacing={8}>
          {/* Logo and Title */}
          <VStack spacing={2} textAlign="center">
            <Heading 
              as="h1" 
              fontSize="3xl" 
              fontWeight="bold"
              color="brand.700"
            >
              Del Norte Course Selector
            </Heading>
            <Text fontSize="lg" color="gray.600">
              Sign in to access your account
            </Text>
          </VStack>

          {/* Login Form */}
          <Box 
            py={8} 
            px={8} 
            width="100%" 
            borderWidth={1} 
            borderRadius="xl" 
            boxShadow="xl" 
            bg="white"
          >
            <form onSubmit={handleSubmit}>
              <Stack spacing={6}>
                <FormControl id="email" isRequired>
                  <FormLabel fontWeight="medium">Email</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <EmailIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                      disabled={loading}
                      size="lg"
                      borderRadius="md"
                      focusBorderColor="brand.500"
                    />
                  </InputGroup>
                </FormControl>

                <FormControl id="password" isRequired>
                  <FormLabel fontWeight="medium">Password</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <LockIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      size="lg"
                      borderRadius="md"
                      focusBorderColor="brand.500"
                    />
                  </InputGroup>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="brand"
                  size="lg"
                  fontSize="md"
                  width="100%"
                  isLoading={loading}
                  loadingText="Signing in..."
                  boxShadow="md"
                  _hover={{
                    transform: 'translateY(-2px)',
                    boxShadow: 'lg',
                  }}
                  _active={{
                    transform: 'translateY(0)',
                    boxShadow: 'md',
                  }}
                >
                  Sign In
                </Button>
              </Stack>
            </form>
          </Box>

          <Box textAlign="center" pt={2}>
            <Text color="gray.600">
              Don't have an account?{' '}
              <Button
                variant="link"
                colorScheme="brand"
                onClick={() => navigate('/signup')}
                isDisabled={loading}
                fontWeight="semibold"
              >
                Sign up
              </Button>
            </Text>
          </Box>
        </VStack>
      </Container>
    </Flex>
  );
};

export default Login;
