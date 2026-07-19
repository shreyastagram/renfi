/**
 * Reusable camera-capture recovery (low-RAM Android process-death survival).
 *
 * On 2–3GB phones the OS may kill our process while the system camera is
 * open; the user taps OK and lands in a cold-restarted app with the picker
 * promise gone. The capture itself survives (the camera app writes into our
 * cache before we resume), so we mark every launch and offer the photo back
 * after a restart. See utils/cameraRecovery.js for the primitives.
 *
 * Usage in a screen:
 *   const result = await launchCameraGuarded({ kind: 'document', docType }, opts);
 *   ...
 *   useCameraRecovery('document', (rec) => stageDoc(rec.docType, recoveredAsset(rec)));
 */
import { useEffect } from 'react';
import { launchCamera } from 'react-native-image-picker';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import {
  markPendingCapture,
  clearPendingCapture,
  recoverPendingCapture,
} from '../utils/cameraRecovery';

/** launchCamera with the pending-capture marker around it. */
export const launchCameraGuarded = async (context, options) => {
  await markPendingCapture(context);
  try {
    return await launchCamera(options);
  } finally {
    await clearPendingCapture();
  }
};

/** Minimal asset shape for staging/upload code that expects a picker asset. */
export const recoveredAsset = (rec) => ({
  uri: rec.uri,
  type: 'image/jpeg',
  fileName: 'camera_recovered.jpg',
});

/**
 * Once per mount: if the app restarted mid-capture for `kind`, confirm with
 * the user and hand the recovered context (incl. `uri`) to `onUsePhoto`.
 */
export const useCameraRecovery = (kind, onUsePhoto) => {
  const { dialog } = useDialog();
  const { t } = useLanguage();

  useEffect(() => {
    let active = true;
    (async () => {
      const rec = await recoverPendingCapture();
      if (!active || !rec?.uri || rec.kind !== kind) return;
      dialog(t('profile.recoveredPhotoTitle'), t('profile.recoveredPhotoMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.ok'), onPress: () => onUsePhoto(rec) },
      ]);
    })();
    return () => { active = false; };
    // Mount-only by design: recovery is one-shot and must not re-prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
