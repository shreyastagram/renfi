/**
 * Help & Support — single source of truth for support contact links.
 *
 * The iconized Help & Support sheet (`SupportSheet`, opened everywhere via
 * `SupportContext`'s `openSupport()`) and any other caller import
 * `SUPPORT_LINKS` from here so the number / email / page URL never drift.
 */
const WHATSAPP_URL = 'https://wa.me/918446385312';
const SUPPORT_EMAIL = 'contact@fixhomi.com';
const SUPPORT_PAGE = 'https://fixhomi.com/support';

export const SUPPORT_LINKS = { WHATSAPP_URL, SUPPORT_EMAIL, SUPPORT_PAGE };
