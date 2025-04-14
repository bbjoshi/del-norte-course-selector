import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  Input,
  Button,
  Text,
  Flex,
  useToast,
  InputGroup,
  InputRightElement,
  Heading,
  useColorModeValue,
  Spinner,
  Center,
  Progress,
} from '@chakra-ui/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ChatInterface.css';
import { PDFService } from '../../services/PDFService';
import { ChatService } from '../../services/ChatService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [embeddingsStatus, setEmbeddingsStatus] = useState({
    inProgress: false,
    complete: false,
    error: null,
    progress: 0,
    vectorCount: 0,
    vectorSearchAvailable: false
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Theme colors
  const userBubbleBg = useColorModeValue('brand.600', 'brand.500');
  const botBubbleBg = useColorModeValue('white', 'gray.700');
  const botBubbleBorder = useColorModeValue('gray.200', 'gray.600');
  const chatBg = useColorModeValue('gray.50', 'gray.800');

  // Initialize services
  const [pdfService] = useState(() => PDFService.getInstance());
  const [chatService] = useState(() => ChatService.getInstance());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function to check embeddings status
  const checkEmbeddingsStatus = async () => {
    try {
      const response = await axios.get('/api/embeddings-status');
      setEmbeddingsStatus(response.data);
      
      // If embeddings generation is complete or there was an error, stop polling
      if (response.data.complete || response.data.error) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking embeddings status:', error);
      return false;
    }
  };

  useEffect(() => {
    const initializePDF = async () => {
      try {
        setIsLoading(true);
        // Use the PDF URL from the server
        await pdfService.loadPDF('/api/pdf');
        
        // Check initial embeddings status
        await checkEmbeddingsStatus();
        
        // Set initialized to true to show the chat interface
        setIsInitialized(true);
        
        // Add welcome message
        const welcomeMessage: Message = {
          id: 'welcome',
          text: "👋 Hello! I'm your Del Norte High School course selection assistant. I can help you with:\n\n" +
                "- Finding specific courses and their requirements\n" +
                "- Creating a 4-year course plan\n" +
                "- Understanding graduation requirements\n" +
                "- Recommending courses based on your interests\n\n" +
                "How can I assist you today?",
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
        
        // Start polling for embeddings status if in progress
        if (embeddingsStatus.inProgress) {
          const pollInterval = setInterval(async () => {
            const isDone = await checkEmbeddingsStatus();
            if (isDone) {
              clearInterval(pollInterval);
            }
          }, 2000); // Check every 2 seconds
          
          // Clean up interval on component unmount
          return () => clearInterval(pollInterval);
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load course catalog',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializePDF();
  }, [pdfService, toast]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !isInitialized) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatService.processQuery(userMessage.text);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get response from the chatbot',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      borderWidth={1}
      borderRadius="xl"
      overflow="hidden"
      bg="white"
      height="70vh"
      display="flex"
      flexDirection="column"
      boxShadow="lg"
    >
      {/* Chat Header */}
      <Box 
        p={4} 
        borderBottomWidth={1} 
        bg="brand.600" 
        color="white"
      >
        <Heading size="md">Course Selection Assistant</Heading>
      </Box>

      {/* Messages Area */}
      {!isInitialized ? (
        <Center flex={1} bg={chatBg}>
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.500" thickness="4px" />
            <Text color="gray.500">Loading course catalog...</Text>
          </VStack>
        </Center>
      ) : embeddingsStatus.inProgress ? (
        <Center flex={1} bg={chatBg}>
          <VStack spacing={4} width="80%">
            <Spinner size="md" color="brand.500" thickness="3px" />
            <Text color="gray.700" fontWeight="medium">Generating AI embeddings for better search results...</Text>
            <Progress 
              value={embeddingsStatus.progress} 
              size="sm" 
              width="100%" 
              colorScheme="brand" 
              hasStripe
              isAnimated
            />
            <Text color="gray.500" fontSize="sm">
              {embeddingsStatus.progress}% complete ({embeddingsStatus.vectorCount} vectors generated)
            </Text>
            <Text color="gray.600" fontSize="sm" mt={2}>
              You can start chatting now, but search results will improve once this process completes.
            </Text>
          </VStack>
        </Center>
      ) : (
        <VStack
          flex={1}
          overflowY="auto"
          p={4}
          spacing={4}
          align="stretch"
          bg={chatBg}
        >
          {messages.map(message => (
            <Flex
              key={message.id}
              justify={message.sender === 'user' ? 'flex-end' : 'flex-start'}
            >
              <Box
                maxW={{ base: "85%", md: "70%" }}
                bg={message.sender === 'user' ? userBubbleBg : botBubbleBg}
                color={message.sender === 'user' ? 'white' : 'inherit'}
                p={4}
                borderRadius="lg"
                boxShadow="md"
                borderWidth={message.sender === 'bot' ? 1 : 0}
                borderColor={message.sender === 'bot' ? botBubbleBorder : 'transparent'}
              >
                {message.sender === 'user' ? (
                  <Text fontWeight="medium">{message.text}</Text>
                ) : (
                  <Box className="markdown-content">
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                  </Box>
                )}
                <Text
                  fontSize="xs"
                  color={message.sender === 'user' ? 'whiteAlpha.800' : 'gray.500'}
                  mt={2}
                  textAlign="right"
                >
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Box>
            </Flex>
          ))}
          <div ref={messagesEndRef} />
        </VStack>
      )}

      {/* Input Area */}
      <Box p={4} borderTopWidth={1} bg="white">
        {embeddingsStatus.error && (
          <Text color="orange.500" mb={2} fontSize="sm">
            Note: Advanced search is unavailable. Using traditional search instead.
          </Text>
        )}
        <form onSubmit={handleSendMessage}>
          <InputGroup size="lg">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about courses, requirements, or recommendations..."
              disabled={isLoading || !isInitialized}
              pr="4.5rem"
              focusBorderColor="brand.500"
              borderRadius="md"
              boxShadow="sm"
              _hover={{ borderColor: 'brand.300' }}
            />
            <InputRightElement width="4.5rem">
              <Button
                h="1.75rem"
                size="sm"
                type="submit"
                colorScheme="brand"
                isLoading={isLoading}
                loadingText="Sending"
                disabled={!isInitialized || !inputMessage.trim()}
                borderRadius="md"
              >
                Send
              </Button>
            </InputRightElement>
          </InputGroup>
        </form>
      </Box>
    </Box>
  );
};

export default ChatInterface;
