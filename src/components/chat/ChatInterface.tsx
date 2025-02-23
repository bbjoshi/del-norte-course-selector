import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  Input,
  Button,
  Text,
  Flex,
  useToast,
  Container,
} from '@chakra-ui/react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Initialize services
  const [pdfService] = useState(() => PDFService.getInstance());
  const [chatService] = useState(() => ChatService.getInstance());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const initializePDF = async () => {
      try {
        setIsLoading(true);
        await pdfService.loadPDF('https://4.files.edl.io/f7e7/02/04/25/231513-8c9f8c2e-257a-49e3-8c4c-ef249811b38e.pdf');
        setIsInitialized(true);
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
    <Container maxW="container.md" py={4}>
      <Box
        borderWidth={1}
        borderRadius="lg"
        overflow="hidden"
        bg="white"
        height="70vh"
        display="flex"
        flexDirection="column"
      >
        {/* Messages Area */}
        <VStack
          flex={1}
          overflowY="auto"
          p={4}
          spacing={4}
          align="stretch"
          bg="gray.50"
        >
          {messages.map(message => (
            <Flex
              key={message.id}
              justify={message.sender === 'user' ? 'flex-end' : 'flex-start'}
            >
              <Box
                maxW="70%"
                bg={message.sender === 'user' ? 'blue.500' : 'white'}
                color={message.sender === 'user' ? 'white' : 'black'}
                p={3}
                borderRadius="lg"
                boxShadow="sm"
              >
                <Text>{message.text}</Text>
                <Text
                  fontSize="xs"
                  color={message.sender === 'user' ? 'white' : 'gray.500'}
                  mt={1}
                >
                  {message.timestamp.toLocaleTimeString()}
                </Text>
              </Box>
            </Flex>
          ))}
          <div ref={messagesEndRef} />
        </VStack>

        {/* Input Area */}
        <Box p={4} borderTopWidth={1}>
          <form onSubmit={handleSendMessage}>
            <Flex gap={2}>
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about course selection..."
                disabled={isLoading || !isInitialized}
              />
              <Button
                type="submit"
                colorScheme="blue"
                isLoading={isLoading}
                loadingText="Sending"
                disabled={!isInitialized}
              >
                Send
              </Button>
            </Flex>
          </form>
        </Box>
      </Box>
    </Container>
  );
};

export default ChatInterface;
