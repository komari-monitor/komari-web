import { Box, Flex, Text } from '@radix-ui/themes';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      style={{
        padding: '2rem 1rem',
        width: '100%',
        borderTop: '1px solid var(--gray-5)',
        marginTop: 'auto',
      }}
    >
      <Flex
        direction={{ initial: 'column', md: 'row' }}
        justify="between"
        align={{ initial: 'center', md: 'start' }}
        gap="4"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Copyright and ICP Filing */}
        <Flex direction="column" gap="2" align={{ initial: 'center', md: 'start' }}>
          <Text size="2" color="gray">
            © {currentYear} Komari Monitor. All rights reserved.
          </Text>
          <Text size="2" color="gray">
            
          </Text>
        </Flex>

      </Flex>
    </Box>
  );
};

export default Footer;

