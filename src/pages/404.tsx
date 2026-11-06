import React from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { PageMotion } from "@/components/motion";
import { CONTENT_MOTION } from "@/lib/motion";

const NotFound: React.FC = () => {
  React.useEffect(() => {
    //document.title = "404 - Page Not Found";
  }, []);
  const [t] = useTranslation();
  return (
    // surface 层：整页沉稳进场；内部三块用 content 层依次跟上（Follow-through）
    <PageMotion
      className="km-page-404 px-km-block py-km-hero"
      style={{ height: '100vh', textAlign: 'center' }}
    >
    <Flex
      direction="column"
      align="center"
      justify="center"
      style={{ height: '100%' }}
      gap="4"
    >
      <motion.div
        custom={0}
        initial={CONTENT_MOTION.item.initial}
        animate={CONTENT_MOTION.item.animate}
        transition={{ ...CONTENT_MOTION.transition, delay: 0.04 }}
      >
        <Text size="9" weight="bold">
          404
        </Text>
      </motion.div>
      <motion.div
        custom={1}
        initial={CONTENT_MOTION.item.initial}
        animate={CONTENT_MOTION.item.animate}
        transition={{ ...CONTENT_MOTION.transition, delay: 0.08 }}
      >
        <Text size="4">
          {t("page_not_found")}
        </Text>
      </motion.div>
      <motion.div
        initial={CONTENT_MOTION.item.initial}
        animate={CONTENT_MOTION.item.animate}
        transition={{ ...CONTENT_MOTION.transition, delay: 0.12 }}
        whileTap={{ scale: 0.97 }}
      >
        <Link to="/">
          <Button variant="soft">{t("go_to_home")}</Button>
        </Link>
      </motion.div>
    </Flex>
    </PageMotion>
  );
};

export default NotFound;