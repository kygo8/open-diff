import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import tseslint from 'typescript-eslint'
import { commandRegistry } from '@/app/commandRegistry'
import { sessionCatalog } from '@/app/sessionCatalog'
import { enUS } from './locales/en-US'

const require = createRequire(import.meta.url)
const vueFiles = listVueFiles(resolve(process.cwd(), 'src'))

const visibleAttributeNames = [
  'aria-label',
  'eyebrow',
  'inspector-label',
  'placeholder',
  'subtitle',
  'title',
]
const quotedValuePattern = /"(.+)"$/

interface TemplateNode {
  type: string
  value?: string
  children?: TemplateNode[]
  startTag?: {
    attributes?: TemplateAttribute[]
  }
}

interface TemplateAttribute {
  directive?: boolean
  key?: {
    name?: string
  }
  value?: {
    value?: string
  }
}

interface VueTemplateParseResult {
  ast: {
    templateBody?: TemplateNode
  }
}

type ParseForESLint = (
  source: string,
  options: {
    ecmaVersion: string
    parser: unknown
    sourceType: string
  },
) => VueTemplateParseResult

const { parseForESLint } = require('vue-eslint-parser') as {
  parseForESLint: ParseForESLint
}

describe('English UI resources', () => {
  it('keeps fixed Vue template UI text behind resource keys', () => {
    const hardcodedText = vueFiles.flatMap(findHardcodedTemplateText)

    expect(hardcodedText).toEqual([])
  })

  it('covers command registry titles and navigation action titles', () => {
    const commandMessageKeys = commandRegistry.flatMap((command) => [
      command.titleKey,
      command.action.type === 'navigate' ? command.action.titleKey : null,
    ])

    expect(commandMessageKeys.filter((key) => key && !enUS.messages[key])).toEqual([])
  })

  it('covers session catalog titles and summaries', () => {
    const sessionMessageKeys = sessionCatalog.flatMap((entry) => [entry.titleKey, entry.summaryKey])

    expect(sessionMessageKeys.filter((key) => !enUS.messages[key])).toEqual([])
  })
})

function findHardcodedTemplateText(filePath: string): string[] {
  const source = readFileSync(resolve(process.cwd(), filePath), 'utf8')
  const templateBody = parseForESLint(source, {
    ecmaVersion: 'latest',
    parser: tseslint.parser,
    sourceType: 'module',
  }).ast.templateBody
  const textNodeMatches: string[] = []
  const attributeMatches: string[] = []

  if (templateBody) {
    walkTemplate(templateBody, (node) => {
      if (node.type === 'VText' && node.value) {
        const value = normalize(node.value)

        if (value) {
          textNodeMatches.push(`${filePath}: text "${value}"`)
        }
      }

      for (const attribute of node.startTag?.attributes ?? []) {
        const attributeName = attribute.key?.name
        const value = normalize(attribute.value?.value ?? '')

        if (
          !attribute.directive &&
          attributeName &&
          visibleAttributeNames.includes(attributeName) &&
          value
        ) {
          attributeMatches.push(`${filePath}: ${attributeName} "${value}"`)
        }
      }
    })
  }

  return [...textNodeMatches, ...attributeMatches].filter((entry) => {
    const value = quotedValuePattern.exec(entry)?.[1] ?? ''

    return (
      /[A-Za-z]/.test(value) &&
      !entry.includes('data:image/') &&
      !isRouteLiteral(value) &&
      !isDataLiteral(value)
    )
  })
}

function walkTemplate(node: TemplateNode, visit: (node: TemplateNode) => void): void {
  visit(node)

  for (const child of node.children ?? []) {
    walkTemplate(child, visit)
  }
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isRouteLiteral(value: string): boolean {
  return /^\/[A-Za-z0-9/_-]+$/u.test(value)
}

function isDataLiteral(value: string): boolean {
  return /^[A-Za-z0-9_./:-]+\.[A-Za-z0-9]+$/u.test(value)
}

function listVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return listVueFiles(absolutePath)
    }

    if (!entry.isFile() || !entry.name.endsWith('.vue')) {
      return []
    }

    return absolutePath.replaceAll('\\', '/').replace(`${process.cwd().replaceAll('\\', '/')}/`, '')
  })
}
