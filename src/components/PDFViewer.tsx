import React from 'react';
import { 
  Box, 
  Button, 
  useDisclosure, 
  Modal, 
  ModalOverlay, 
  ModalContent, 
  ModalHeader, 
  ModalCloseButton, 
  ModalBody, 
  ModalFooter,
  Text,
  useColorModeValue
} from '@chakra-ui/react';

interface PDFViewerProps {
  pdfUrl: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const buttonBg = useColorModeValue('brand.600', 'brand.500');
  const buttonHoverBg = useColorModeValue('brand.700', 'brand.600');

  const downloadPDF = () => {
    // Create a link element
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'del-norte-course-catalog.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Button 
        onClick={onOpen} 
        colorScheme="brand" 
        size="sm"
        boxShadow="sm"
        _hover={{
          bg: buttonHoverBg,
          transform: 'translateY(-1px)',
          boxShadow: 'md',
        }}
      >
        View Course Catalog
      </Button>

      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        size="xl" 
        scrollBehavior="inside"
        motionPreset="slideInBottom"
      >
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(5px)" />
        <ModalContent maxW="900px" h="85vh" borderRadius="xl">
          <ModalHeader 
            borderBottomWidth="1px" 
            bg={buttonBg} 
            color="white"
            borderTopRadius="xl"
            py={4}
          >
            Del Norte High School Course Catalog (2026-2027)
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody p={0}>
            <Box height="100%" overflowY="auto">
              <embed
                src={pdfUrl}
                type="application/pdf"
                width="100%"
                height="100%"
                style={{ border: 'none' }}
              />
            </Box>
          </ModalBody>
          <ModalFooter borderTopWidth="1px" justifyContent="space-between">
            <Text fontSize="sm" color="gray.500">
              Use this catalog to explore available courses and requirements
            </Text>
            <Button 
              colorScheme="brand" 
              onClick={downloadPDF}
              size="md"
              boxShadow="sm"
            >
              Download PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PDFViewer;
