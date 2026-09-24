import React from "react";
import { useTranslation } from "react-i18next";
import {
  AlignLeft,
  Calendar,
  Coins,
  Contact,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { DataType } from "../types";

interface DataTypeSelectorProps {
  currentType: DataType;
  onChange: (type: DataType) => void;
}

interface TypeItem {
  type: DataType;
  icon: LucideIcon;
  labelKey: string;
}

const TYPES: TypeItem[] = [
  { type: "url", icon: Globe, labelKey: "qr.types.url" },
  { type: "text", icon: AlignLeft, labelKey: "qr.types.text" },
  { type: "wifi", icon: Wifi, labelKey: "qr.types.wifi" },
  { type: "vcard", icon: Contact, labelKey: "qr.types.vcard" },
  { type: "email", icon: Mail, labelKey: "qr.types.email" },
  { type: "phone", icon: Phone, labelKey: "qr.types.phone" },
  { type: "sms", icon: MessageSquare, labelKey: "qr.types.sms" },
  { type: "whatsapp", icon: MessageCircle, labelKey: "qr.types.whatsapp" },
  { type: "event", icon: Calendar, labelKey: "qr.types.event" },
  { type: "geo", icon: MapPin, labelKey: "qr.types.geo" },
  { type: "crypto", icon: Coins, labelKey: "qr.types.crypto" },
];

export function DataTypeSelector({ currentType, onChange }: DataTypeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="qrg-types-bar" role="tablist">
      {TYPES.map(({ type, icon: Icon, labelKey }) => {
        const active = currentType === type;
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={active}
            className={`qrg-type-pill ${active ? "qrg-type-pill--active" : ""}`}
            onClick={() => onChange(type)}
          >
            <Icon size={16} />
            <span>{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
