import FormBuilder from '@/components/builder/FormBuilder';

export const metadata = {
  title: '양식 편집기 - Web Report Editor',
};

export default function BuilderPage() {
  return (
    <div className="min-h-screen">
      <FormBuilder />
    </div>
  );
}
