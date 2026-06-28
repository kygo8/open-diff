export interface PortablePackageRequest {
  productName: string
  version: string
  releaseDir: string
  outputDir: string
}

export interface PortablePackageFile {
  source: string
  target: string
}

export interface PortablePackagePlan {
  archiveName: string
  archivePath: string
  files: PortablePackageFile[]
}

export function createWindowsPortablePackagePlan(
  request: PortablePackageRequest,
): PortablePackagePlan {
  const archiveName = `${request.productName}_${request.version}_x64_portable.zip`

  return {
    archiveName,
    archivePath: `${request.outputDir}/${archiveName}`,
    files: [
      {
        source: `${request.releaseDir}/open-diff-app.exe`,
        target: 'open-diff-app.exe',
      },
      {
        source: `${request.releaseDir}/open-diff-cli.exe`,
        target: 'open-diff-cli.exe',
      },
      {
        source: 'README.md',
        target: 'README.md',
      },
      {
        source: 'LICENSE',
        target: 'LICENSE',
      },
    ],
  }
}
