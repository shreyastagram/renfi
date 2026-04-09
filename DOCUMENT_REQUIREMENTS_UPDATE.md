# Document Requirements Update — Implementation Guide

## Purpose

Update the document verification system to match the new service provider requirements spec. This includes changing document requirements, adding "any one of" logic, universal driving license requirement, and fixing category mismatches.

---

## What Changes

### New DOCUMENT_REQUIREMENTS Structure

The current flat array means ALL documents are mandatory. The new spec needs support for:
- **required**: ALL of these must be uploaded
- **anyOneOf**: Upload at least ONE from this group  
- **optional**: Nice to have, not required for approval

```javascript
const DOCUMENT_REQUIREMENTS = {
  // ── Trades (all share same structure) ──
  electrician:            { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },
  plumber:                { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },
  carpenter:              { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },
  painter:                { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },
  welder:                 { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },
  mason_tiler:            { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },
  solar_repairing:        { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },

  // ── Electronics (AC/Fridge/TV) — NO contractor auth ──
  electronics_technician: { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },
  ac_repair:              { required: ['driving_license'], anyOneOf: ['skill_certificate'], optional: ['e_shram_card'] },

  // ── Salon ──
  salon:                  { required: ['driving_license'], anyOneOf: ['salon_license', 'beauty_certificate', 'e_shram_card'], optional: [] },

  // ── Vehicle Cleaning ──
  vehicle_cleaning:       { required: ['driving_license'], anyOneOf: ['business_registration', 'gst_certificate', 'trade_license', 'e_shram_card'], optional: [] },

  // ── Driver ──
  driver:                 { required: ['commercial_driving_license'], anyOneOf: [], optional: ['e_shram_card'] },

  // ── Influencer ──
  influencer:             { required: ['driving_license', 'social_media_verification'], anyOneOf: [], optional: ['e_shram_card'] },

  // ── Photographer ──
  photographer:           { required: ['driving_license', 'portfolio_proof'], anyOneOf: ['business_registration', 'gst_certificate'], optional: ['e_shram_card'] },

  // ── Emergency: Snake Catcher ──
  snake_catcher:          { required: ['driving_license', 'wildlife_rescue_certificate', 'pan_card', 'voter_id'], anyOneOf: [], optional: ['e_shram_card'] },

  // ── Emergency: Ambulance ──
  ambulance_services:     { required: ['driving_license', 'vehicle_photo', 'vehicle_rc', 'staff_id_proof', 'bls_als_certificate'], anyOneOf: [], optional: ['e_shram_card'] },

  // ── Emergency: Mortuary Van ──
  mortuary_van:           { required: ['driving_license', 'vehicle_photo', 'vehicle_rc', 'staff_id_proof', 'mortuary_certificate'], anyOneOf: [], optional: ['e_shram_card'] },
};
```

### New Document Types to Add to Schema Enum

Currently missing from the document type enum:
- `commercial_driving_license`
- `gst_certificate`
- `wildlife_rescue_certificate`
- `pan_card`
- `voter_id`
- `e_shram_card`

### Documents Removed (No Longer Used)
- `experience_proof` — replaced by skill_certificate only
- `iti_diploma` — folded into skill_certificate (provider uploads whichever they have)
- `trade_certificate` — folded into skill_certificate
- `shop_license` — removed
- `commercial_badge` — replaced by commercial_driving_license
- `vehicle_insurance` — removed from driver requirements
- `id_proof` — replaced by specific IDs (pan_card, voter_id)
- `forest_department_certificate` — replaced by wildlife_rescue_certificate
- `firefighting_certificate` — fire_brigade removed from categories
- `gst_registration` — replaced by gst_certificate (same concept, cleaner name)

### Categories Removed
- `fire_brigade` — removed from ALLOWED_SERVICE_CATEGORIES and DOCUMENT_REQUIREMENTS
- `cleaning` — was never in DOCUMENT_REQUIREMENTS

### What "skill_certificate" Means to the Provider
The UI label should explain: "Government-recognized Skill Certificate (ITI Certificate, Vocational Training Certificate, Diploma/Degree, Contractor Authorization Letter, or E-Shram Card)"

---

## Files to Modify

### Backend
| File | Change |
|------|--------|
| `models/provider.js` | Update DOCUMENT_REQUIREMENTS to new structure, update document type enum, update ALLOWED_SERVICE_CATEGORIES |
| `controllers/documentVerificationController.js` | Update validation to support required/anyOneOf/optional, update document labels |

### Frontend (React Native)
| File | Change |
|------|--------|
| `screens/ServiceApprovalsScreen.jsx` | Update DOCUMENT_LABELS, SERVICE_LABELS, update document upload UI to show required vs anyOneOf |
| `screens/DocumentVerificationScreen.jsx` | Same label updates |
| `services/traditionalServiceService.js` | Remove fire_brigade from labels if present |

### Admin (React + Vite)
| File | Change |
|------|--------|
| `pages/ProviderDetail.jsx` | Update DOC_LABELS for new document types |

---

## Validation Logic Change

### Current (ALL mandatory)
```javascript
const requiredDocs = DOCUMENT_REQUIREMENTS[category]; // flat array
const missing = requiredDocs.filter(d => !provided.includes(d));
if (missing.length > 0) reject;
```

### New (required + anyOneOf + optional)
```javascript
const reqs = DOCUMENT_REQUIREMENTS[category];
// Check ALL required docs present
const missingRequired = reqs.required.filter(d => !provided.includes(d));
if (missingRequired.length > 0) reject("Missing required: ...");

// Check at least ONE from anyOneOf group (if group is non-empty)
if (reqs.anyOneOf.length > 0) {
  const hasAny = reqs.anyOneOf.some(d => provided.includes(d));
  if (!hasAny) reject("Upload at least one of: ...");
}
// optional docs: no validation needed
```

---

## Progress Tracker

| # | Task | Status |
|---|------|--------|
| 1 | Update DOCUMENT_REQUIREMENTS in provider.js | DONE | New required/anyOneOf/optional structure for all 17 categories |
| 2 | Update document type enum in provider.js | DONE | Added 6 new types, kept legacy types for backward compat |
| 3 | Update ALLOWED_SERVICE_CATEGORIES (remove fire_brigade) | DONE | 17 categories (was 18) |
| 4 | Update validation logic in documentVerificationController.js | DONE | Supports required + anyOneOf + optional validation |
| 5 | Update document labels in documentVerificationController.js | DONE | All new document types labeled |
| 6 | Update ServiceApprovalsScreen.jsx labels + UI | DONE | Labels updated, fire_brigade/cleaning removed |
| 7 | Update DocumentVerificationScreen.jsx labels | DONE | Labels updated, fire_brigade/cleaning removed |
| 8 | Update ProviderHomeScreen + ProfileScreen labels | DONE | fire_brigade/cleaning removed from both |
| 9 | Update admin ProviderDetail.jsx labels | DONE | All new doc types labeled, legacy kept |
| 10 | Update authController.js category list | DONE | fire_brigade removed from registration validation |
| 11 | Test: verify old approved providers still work | PENDING | Legacy doc types in enum ensure no DB errors |
