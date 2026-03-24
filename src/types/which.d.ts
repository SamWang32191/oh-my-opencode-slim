declare module 'which' {
  interface WhichOptions {
    path?: string;
    pathExt?: string;
    nothrow?: boolean;
  }

  interface WhichSync {
    sync(command: string, options?: WhichOptions): string | null;
  }

  const whichSync: WhichSync;

  export default whichSync;
}
