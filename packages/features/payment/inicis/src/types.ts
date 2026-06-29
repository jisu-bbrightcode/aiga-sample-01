export type InicisMode = "test" | "production";

export interface InicisConfig {
  mode: InicisMode;
  mid: string;
  signKey: string;
  iniApiKey: string;
  clientIp: string;
  returnBaseUrl: string;
  notiUrl?: string;
  closeUrl?: string;
  notiAllowedIps: string[];
}

export interface InicisCheckoutInput {
  orderId: string;
  amount: number;
  goodsName: string;
  buyerName: string;
  buyerTel: string;
  buyerEmail: string;
  payMethod?: string;
  returnUrl?: string;
  closeUrl?: string;
  merchantData?: Record<string, string>;
}

export interface InicisCheckoutForm {
  endpoint: string;
  method: "POST";
  contentType: "application/x-www-form-urlencoded";
  fields: Record<string, string>;
}

export interface InicisAuthResult {
  resultCode: string;
  resultMsg?: string;
  mid?: string;
  orderNumber?: string;
  authToken?: string;
  authUrl?: string;
  netCancelUrl?: string;
  idc_name?: string;
  merchantData?: string;
}

export interface InicisApprovalResult {
  resultCode: string;
  resultMsg?: string;
  tid?: string;
  MOID?: string;
  TotPrice?: string;
  applDate?: string;
  applTime?: string;
  payMethod?: string;
  buyerEmail?: string;
  CARD_Num?: string;
  [key: string]: string | undefined;
}

export interface InicisNotiPayload {
  no_tid?: string;
  no_oid?: string;
  amt_input?: string;
  P_STATUS?: string;
  P_TID?: string;
  P_OID?: string;
  P_AMT?: string;
  P_NOTI?: string;
  [key: string]: string | undefined;
}

export interface InicisCancelInput {
  tid: string;
  reason: string;
  amount?: number;
  confirmPrice?: number;
  payMethod?: string;
}

export interface InicisInquiryInput {
  tid?: string;
  oid?: string;
}

export interface InicisApiResult {
  resultCode: string;
  resultMsg?: string;
  tid?: string;
  mid?: string;
  oid?: string;
  [key: string]: unknown;
}
