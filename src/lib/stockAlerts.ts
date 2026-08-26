import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * "Tell me when it's back": a visitor leaves an email against a product,
 * and a Cloud Function mails everyone on the list the moment the product
 * flips to in-stock. The doc id is product + email, so asking twice just
 * refreshes the same subscription instead of stacking duplicates.
 */
export async function subscribeToStock(productId: string, email: string): Promise<void> {
  const database = db;
  const clean = email.trim().toLowerCase();
  if (!clean.includes('@') || clean.length > 200) throw new Error('That email does not look right.');
  if (!database) throw new Error('Notifications need a connection.');
  const id = `${productId}_${clean.replace(/\//g, '_')}`;
  await setDoc(doc(database, 'stockAlerts', id), {
    productId,
    email: clean,
    notified: false,
    createdAt: serverTimestamp(),
  });
}
