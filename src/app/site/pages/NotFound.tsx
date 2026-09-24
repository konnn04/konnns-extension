import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";
import { Button } from "@/shared/ui";
import { navigate } from "@/core/router/useHashRoute";

export function NotFound({ path }: { path: string }) {
  const { t } = useTranslation();
  return (
    <div className="site__notfound">
      <Compass size={40} />
      <h1>{t("site.notFound.title")}</h1>
      <p>
        <code>{path}</code>
      </p>
      <Button variant="primary" onClick={() => navigate("/")}>
        {t("site.notFound.action")}
      </Button>
    </div>
  );
}
