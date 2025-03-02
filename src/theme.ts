import { extendTheme } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// Professional color palette
const colors = {
  brand: {
    50: '#e6f6ff',
    100: '#bae3ff',
    200: '#7cc4fa',
    300: '#47a3f3',
    400: '#2186eb',
    500: '#0967d2',
    600: '#0552b5',
    700: '#03449e',
    800: '#01337d',
    900: '#002159',
  },
  accent: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
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
