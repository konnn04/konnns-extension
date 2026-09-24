import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, MapPin } from "lucide-react";
import { Field, Select, TextInput } from "@/shared/ui";
import type { QrConfig } from "../types";

interface ContentInputsProps {
  config: QrConfig;
  onChange: (patch: Partial<QrConfig>) => void;
}

export function ContentInputs({ config, onChange }: ContentInputsProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const updateWifi = (patch: Partial<QrConfig["wifi"]>) => {
    onChange({ wifi: { ...config.wifi, ...patch } });
  };

  const updateVCard = (patch: Partial<QrConfig["vcard"]>) => {
    onChange({ vcard: { ...config.vcard, ...patch } });
  };

  const updateEmail = (patch: Partial<QrConfig["email"]>) => {
    onChange({ email: { ...config.email, ...patch } });
  };

  const updateSms = (patch: Partial<QrConfig["sms"]>) => {
    onChange({ sms: { ...config.sms, ...patch } });
  };

  const updateWhatsapp = (patch: Partial<QrConfig["whatsapp"]>) => {
    onChange({ whatsapp: { ...config.whatsapp, ...patch } });
  };

  const updateEvent = (patch: Partial<QrConfig["event"]>) => {
    onChange({ event: { ...config.event, ...patch } });
  };

  const updateGeo = (patch: Partial<QrConfig["geo"]>) => {
    onChange({ geo: { ...config.geo, ...patch } });
  };

  const updateCrypto = (patch: Partial<QrConfig["crypto"]>) => {
    onChange({ crypto: { ...config.crypto, ...patch } });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateGeo({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
      },
      () => {},
      { timeout: 8000 },
    );
  };

  return (
    <div className="qrg-content-inputs">
      {config.type === "url" && (
        <Field label={t("qr.fields.url")}>
          <TextInput
            placeholder="https://example.com"
            value={config.rawText}
            onChange={(e) => onChange({ rawText: e.target.value })}
            autoFocus
          />
        </Field>
      )}

      {config.type === "text" && (
        <Field label={t("qr.fields.text")}>
          <textarea
            className="ui-input qrg-textarea"
            rows={4}
            placeholder={t("qr.placeholders.text")}
            value={config.rawText}
            onChange={(e) => onChange({ rawText: e.target.value })}
            autoFocus
          />
        </Field>
      )}

      {config.type === "wifi" && (
        <div className="qrg-grid-2">
          <Field label={t("qr.fields.ssid")}>
            <TextInput
              placeholder="MyHome_WiFi"
              value={config.wifi.ssid}
              onChange={(e) => updateWifi({ ssid: e.target.value })}
            />
          </Field>

          <Field label={t("qr.fields.password")}>
            <div className="qrg-password-field">
              <TextInput
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={config.wifi.password}
                onChange={(e) => updateWifi({ password: e.target.value })}
              />
              <button
                type="button"
                className="qrg-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? t("qr.fields.hidePassword", "Hide password") : t("qr.fields.showPassword", "Show password")}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Field label={t("qr.fields.encryption")}>
            <Select
              value={config.wifi.encryption}
              onChange={(v) => updateWifi({ encryption: v as "WPA" | "WEP" | "nopass" })}
              options={[
                { value: "WPA", label: "WPA / WPA2 / WPA3" },
                { value: "WEP", label: "WEP" },
                { value: "nopass", label: t("qr.fields.noPassword") },
              ]}
            />
          </Field>

          <label className="qrg-checkbox-row">
            <input
              type="checkbox"
              checked={config.wifi.hidden}
              onChange={(e) => updateWifi({ hidden: e.target.checked })}
            />
            <span>{t("qr.fields.hiddenNetwork")}</span>
          </label>
        </div>
      )}

      {config.type === "vcard" && (
        <div className="qrg-grid-2">
          <Field label={t("qr.fields.firstName")}>
            <TextInput
              placeholder={t("qr.placeholders.firstName", "Văn A")}
              value={config.vcard.firstName}
              onChange={(e) => updateVCard({ firstName: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.lastName")}>
            <TextInput
              placeholder={t("qr.placeholders.lastName", "Nguyễn")}
              value={config.vcard.lastName}
              onChange={(e) => updateVCard({ lastName: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.phone")}>
            <TextInput
              placeholder="+84 987 654 321"
              value={config.vcard.phone}
              onChange={(e) => updateVCard({ phone: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.email")}>
            <TextInput
              type="email"
              placeholder="example@gmail.com"
              value={config.vcard.email}
              onChange={(e) => updateVCard({ email: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.company")}>
            <TextInput
              placeholder="Tech Corp"
              value={config.vcard.company}
              onChange={(e) => updateVCard({ company: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.jobTitle")}>
            <TextInput
              placeholder="Product Designer"
              value={config.vcard.job}
              onChange={(e) => updateVCard({ job: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.website")}>
            <TextInput
              placeholder="https://portfolio.me"
              value={config.vcard.website}
              onChange={(e) => updateVCard({ website: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.address")}>
            <TextInput
              placeholder={t("qr.placeholders.address", "Hà Nội, Việt Nam")}
              value={config.vcard.address}
              onChange={(e) => updateVCard({ address: e.target.value })}
            />
          </Field>
        </div>
      )}

      {config.type === "email" && (
        <div className="qrg-grid-1">
          <Field label={t("qr.fields.emailTo")}>
            <TextInput
              type="email"
              placeholder="recipient@example.com"
              value={config.email.email}
              onChange={(e) => updateEmail({ email: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.subject")}>
            <TextInput
              placeholder={t("qr.placeholders.emailSubject", "Liên hệ hợp tác...")}
              value={config.email.subject}
              onChange={(e) => updateEmail({ subject: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.body")}>
            <textarea
              className="ui-input qrg-textarea"
              rows={3}
              placeholder={t("qr.placeholders.emailBody", "Nội dung email...")}
              value={config.email.body}
              onChange={(e) => updateEmail({ body: e.target.value })}
            />
          </Field>
        </div>
      )}

      {config.type === "phone" && (
        <Field label={t("qr.fields.phoneNumber")}>
          <TextInput
            type="tel"
            placeholder="+84 987 654 321"
            value={config.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </Field>
      )}

      {config.type === "sms" && (
        <div className="qrg-grid-1">
          <Field label={t("qr.fields.phoneNumber")}>
            <TextInput
              type="tel"
              placeholder="+84 987 654 321"
              value={config.sms.phone}
              onChange={(e) => updateSms({ phone: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.message")}>
            <textarea
              className="ui-input qrg-textarea"
              rows={3}
              placeholder={t("qr.placeholders.smsMessage", "Nội dung SMS...")}
              value={config.sms.message}
              onChange={(e) => updateSms({ message: e.target.value })}
            />
          </Field>
        </div>
      )}

      {config.type === "whatsapp" && (
        <div className="qrg-grid-1">
          <Field label={t("qr.fields.whatsappPhone")}>
            <TextInput
              type="tel"
              placeholder="+84987654321"
              value={config.whatsapp.phone}
              onChange={(e) => updateWhatsapp({ phone: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.message")}>
            <textarea
              className="ui-input qrg-textarea"
              rows={3}
              placeholder={t("qr.placeholders.whatsappMessage", "Tin nhắn WhatsApp...")}
              value={config.whatsapp.message}
              onChange={(e) => updateWhatsapp({ message: e.target.value })}
            />
          </Field>
        </div>
      )}

      {config.type === "event" && (
        <div className="qrg-grid-2">
          <div className="qrg-col-full">
            <Field label={t("qr.fields.eventTitle")}>
              <TextInput
                placeholder={t("qr.placeholders.eventTitle", "Buổi họp chiến lược Q4")}
                value={config.event.title}
                onChange={(e) => updateEvent({ title: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("qr.fields.startTime")}>
            <TextInput
              type="datetime-local"
              value={config.event.start}
              onChange={(e) => updateEvent({ start: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.endTime")}>
            <TextInput
              type="datetime-local"
              value={config.event.end}
              onChange={(e) => updateEvent({ end: e.target.value })}
            />
          </Field>
          <div className="qrg-col-full">
            <Field label={t("qr.fields.location")}>
              <TextInput
                placeholder={t("qr.placeholders.eventLocation", "Phòng họp tầng 5 / Online Google Meet")}
                value={config.event.location}
                onChange={(e) => updateEvent({ location: e.target.value })}
              />
            </Field>
          </div>
          <div className="qrg-col-full">
            <Field label={t("qr.fields.description")}>
              <textarea
                className="ui-input qrg-textarea"
                rows={2}
                placeholder={t("qr.placeholders.eventDesc", "Mô tả sự kiện...")}
                value={config.event.description}
                onChange={(e) => updateEvent({ description: e.target.value })}
              />
            </Field>
          </div>
        </div>
      )}

      {config.type === "geo" && (
        <div className="qrg-grid-2">
          <Field label={t("qr.fields.latitude")}>
            <TextInput
              placeholder="21.028511"
              value={config.geo.latitude}
              onChange={(e) => updateGeo({ latitude: e.target.value })}
            />
          </Field>
          <Field label={t("qr.fields.longitude")}>
            <TextInput
              placeholder="105.854167"
              value={config.geo.longitude}
              onChange={(e) => updateGeo({ longitude: e.target.value })}
            />
          </Field>
          <div className="qrg-col-full">
            <button type="button" className="qrg-btn-secondary" onClick={getCurrentLocation}>
              <MapPin size={15} />
              <span>{t("qr.fields.useCurrentLocation")}</span>
            </button>
          </div>
        </div>
      )}

      {config.type === "crypto" && (
        <div className="qrg-grid-2">
          <Field label={t("qr.fields.coin")}>
            <Select
              value={config.crypto.coin}
              onChange={(v) => updateCrypto({ coin: v as "BTC" | "ETH" | "USDT" | "SOL" | "BNB" })}
              options={[
                { value: "BTC", label: "Bitcoin (BTC)" },
                { value: "ETH", label: "Ethereum (ETH)" },
                { value: "USDT", label: "Tether (USDT)" },
                { value: "SOL", label: "Solana (SOL)" },
                { value: "BNB", label: "BNB" },
              ]}
            />
          </Field>
          <Field label={t("qr.fields.amount")}>
            <TextInput
              placeholder="0.05"
              value={config.crypto.amount}
              onChange={(e) => updateCrypto({ amount: e.target.value })}
            />
          </Field>
          <div className="qrg-col-full">
            <Field label={t("qr.fields.walletAddress")}>
              <TextInput
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                value={config.crypto.address}
                onChange={(e) => updateCrypto({ address: e.target.value })}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
