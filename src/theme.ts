import { extendTheme } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// Del Norte High School color palette
// Primary: Dark Navy #002147 rgb(0,33,71)
// Accent: Olive/Sage Green #91976C rgb(145,151,108)
const colors = {
  brand: {
    50: '#e8eef6',
    100: '#b9c9e2',
    200: '#8aa4ce',
    300: '#5b7fba',
    400: '#3c63a8',
    500: '#1e4a96',
    600: '#143a7d',
    700: '#0a2d65',
    800: '#042550',
    900: '#002147',
  },
  accent: {
    50: '#f4f5ee',
    100: '#e2e4d4',
    200: '#cfd2b8',
    300: '#bcc09a',
    400: '#adb284',
    500: '#91976C',
    600: '#7a8058',
    700: '#636846',
    800: '#4d5135',
    900: '#373a26',
  },
};

// Typography
const fonts = {
  heading: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
};

// Component styles
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'md',
    },
    variants: {
      solid: (props: any) => ({
        bg: props.colorScheme === 'blue' ? 'brand.600' : undefined,
        _hover: {
          bg: props.colorScheme === 'blue' ? 'brand.700' : undefined,
        },
      }),
      outline: (props: any) => ({
        borderColor: props.colorScheme === 'blue' ? 'brand.600' : undefined,
        color: props.colorScheme === 'blue' ? 'brand.600' : undefined,
        _hover: {
          bg: mode('brand.50', 'rgba(9, 103, 210, 0.12)')(props),
        },
      }),
    },
    defaultProps: {
      colorScheme: 'brand',
    },
  },
  Input: {
    baseStyle: {
      field: {
        borderRadius: 'md',
      },
    },
    variants: {
      outline: {
        field: {
          borderColor: 'gray.300',
          _hover: {
            borderColor: 'gray.400',
          },
          _focus: {
            borderColor: 'brand.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
          },
        },
      },
    },
  },
  Heading: {
    baseStyle: {
      fontWeight: '700',
    },
  },
  Card: {
    baseStyle: {
      container: {
        borderRadius: 'lg',
        boxShadow: 'md',
      },
    },
  },
  Modal: {
    baseStyle: {
      dialog: {
        borderRadius: 'lg',
      },
    },
  },
};

// Global styles
const styles = {
  global: (props: any) => ({
    body: {
      bg: mode('gray.50', 'gray.900')(props),
      color: mode('gray.800', 'whiteAlpha.900')(props),
    },
  }),
};

const theme = extendTheme({
  config,
  colors,
  fonts,
  components,
  styles,
});

export default theme;
