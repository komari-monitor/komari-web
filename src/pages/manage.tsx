import { useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";

// manage 只是兼容重定向页：用同一个 surface 进场，避免跳转瞬间白屏硬切
const PageMotion = lazy(() =>
  import("@/components/motion").then((module) => ({ default: module.PageMotion })),
);

const ManagePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/admin/dashboard", { replace: true });
  }, [navigate]);

  return (
    <Suspense fallback={null}>
      <PageMotion className="km-page-manage flex flex-col items-center justify-center gap-km-group h-screen px-km-block">
        <p>
          This page is provided for compatibility with Isatidia's frontend
          program.
        </p>
        <p>
          If you are looking for the admin panel, please go to{" "}
          <a href="/admin/dashboard">/admin/dashboard</a>.
        </p>
      </PageMotion>
    </Suspense>
  );
};

export default ManagePage;
