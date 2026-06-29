import { createMillisTimestamp, inicisMKey, inicisSignature } from "./hash";
import type { InicisCheckoutForm, InicisCheckoutInput, InicisConfig } from "./types";

export const INICIS_STDPAY_ENDPOINT = "https://stdpay.inicis.com/stdjs/INIStdPay.js";

export function buildPcStdpayCheckout(
  cfg: InicisConfig,
  input: InicisCheckoutInput,
  now = Date.now(),
): InicisCheckoutForm {
  const timestamp = createMillisTimestamp(now);
  const price = String(input.amount);
  const orderFields = {
    oid: input.orderId,
    price,
    timestamp,
  };
  const verificationFields = {
    oid: input.orderId,
    price,
    signKey: cfg.signKey,
    timestamp,
  };
  const returnUrl = input.returnUrl ?? `${cfg.returnBaseUrl}/api/payment/inicis/return`;
  const closeUrl = input.closeUrl ?? cfg.closeUrl ?? `${cfg.returnBaseUrl}/payment/inicis/close`;
  const merchantData = {
    ...(input.merchantData ?? {}),
    orderId: input.orderId,
  };

  return {
    endpoint: INICIS_STDPAY_ENDPOINT,
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    fields: {
      version: "1.0",
      gopaymethod: input.payMethod ?? "",
      mid: cfg.mid,
      oid: input.orderId,
      price,
      timestamp,
      use_chkfake: "Y",
      signature: inicisSignature(orderFields),
      verification: inicisSignature(verificationFields),
      mKey: inicisMKey(cfg.signKey),
      goodname: input.goodsName,
      buyername: input.buyerName,
      buyertel: input.buyerTel,
      buyeremail: input.buyerEmail,
      returnUrl,
      closeUrl,
      acceptmethod: "centerCd(Y)",
      merchantData: JSON.stringify(merchantData),
    },
  };
}
