import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { usePublicInfo } from "@/contexts/PublicInfoContext";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

const LoginDialog = () => {
  const { isLogin, setIsLogin, publicInfo } = usePublicInfo();

  const [t] = useTranslation();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [twoFac, setTwoFac] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [require2Fac] = React.useState(true);

  const isFormValid = username.trim() !== "" && password.trim() !== "";

  const handleLogin = async () => {
    if (!isFormValid) {
      setErrorMsg("Username and password are required");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          ...(twoFac && !require2Fac ? { twoFac } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 200) {
        setIsLogin(true);
        window.open("/manage", "_self");
      } else {
        setErrorMsg(data.error || "Login failed");
      }
    } catch (err) {
      setErrorMsg("Network error");

      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading && isFormValid) {
      e.preventDefault();
      handleLogin();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLoading) {
      handleLogin();
    }
  };

  return isLogin ? (
    <Button asChild variant="outline" size="icon">
      <Link to="/manage">
        <Settings />
      </Link>
    </Button>
  ) : (
    (!publicInfo?.disable_password_login || publicInfo?.oauth_enable) && (
      <Dialog>
        <DialogTrigger asChild>
          <Button>{t("loginCard.title")}</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("loginCard.title")}</DialogTitle>
            <DialogDescription>{t("loginCard.desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Conditional Password Login Form */}
              {!publicInfo?.disable_password_login && (
                <>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="username">{t("loginCard.username")}</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="admin"
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="password">{t("loginCard.password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t("loginCard.password_placeholder")}
                      disabled={isLoading}
                    />
                  </div>
                  <div
                    className="grid w-full items-center gap-1.5"
                    hidden={require2Fac}
                  >
                    <Label htmlFor="twoFac">{t("loginCard.two_factor")}</Label>
                    <Input
                      id="twoFac"
                      type="text"
                      value={twoFac}
                      onChange={(e) => setTwoFac(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="000000"
                      disabled={isLoading}
                    />
                  </div>
                  {errorMsg && (
                    <p className="text-sm text-red-500">{errorMsg}</p>
                  )}
                  <Button type="submit" disabled={isLoading || !isFormValid}>
                    {isLoading ? "Logging in..." : t("loginCard.title")}
                  </Button>
                </>
              )}

              {/* Conditional OAuth Login Button */}
              {publicInfo?.oauth_enable && (
                <Button
                  onClick={() => {
                    window.location.href = "/api/oauth";
                  }}
                  variant="secondary"
                  disabled={isLoading}
                  type="button"
                >
                  {t("loginCard.login_with_github")}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  );
};

export default LoginDialog;
