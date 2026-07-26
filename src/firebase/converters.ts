import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { ZodType } from "zod";

export function zodConverter<T extends object>(
  schema: ZodType<T>,
): FirestoreDataConverter<T> {
  return {
    toFirestore(value: T): DocumentData {
      return schema.parse(value);
    },
    fromFirestore(
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions,
    ): T {
      return schema.parse(snapshot.data(options));
    },
  };
}

