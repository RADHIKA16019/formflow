import { Suspense } from "react";
import FormBuilder from "./form-builder";

export default function FormBuilderPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading form...</div>}>
      <FormBuilder />
    </Suspense>
  );
}