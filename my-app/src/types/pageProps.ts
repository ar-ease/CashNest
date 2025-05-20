export type PageProps = {
  params: Promise<{ id?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
