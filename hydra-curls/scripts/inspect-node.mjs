#!/usr/bin/env node
/**
 * Prints a measured subtree of the Figma frame, for building one section at a time.
 *
 *   node scripts/inspect-node.mjs "Frame 75"        by node name (prefix match)
 *   node scripts/inspect-node.mjs 1199 2029         by y-range, top-level nodes in it
 *   node scripts/inspect-node.mjs "Frame 75" --depth 3
 *
 * Coordinates are printed relative to the frame origin, which is how the design spec's
 * y-coordinate map is expressed. Everything shown here is read straight from nodes.json, so
 * measurements come from the file rather than from squinting at a render.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODES = join(resolve(__dirname, '..', '..'), 'docs', 'figma', 'raw', 'nodes.json')

const argv = process.argv.slice(2)
const depthFlag = argv.indexOf('--depth')
const maxDepth = depthFlag === -1 ? 99 : Number(argv[depthFlag + 1])
const args = depthFlag === -1 ? argv : argv.slice(0, depthFlag)

if (args.length === 0) {
  console.error('usage: inspect-node.mjs "<node name>" | <yFrom> <yTo> [--depth N]')
  process.exit(1)
}

const doc = JSON.parse(readFileSync(NODES, 'utf8'))
const root = doc.nodes ? Object.values(doc.nodes)[0].document : (doc.document ?? doc)

const findFrame = (n) => {
  if (n.id === '1:503') return n
  for (const c of n.children ?? []) {
    const hit = findFrame(c)
    if (hit) return hit
  }
  return null
}
const frame = findFrame(root) ?? root
const { x: ox, y: oy } = frame.absoluteBoundingBox

const hex = (c) =>
  '#' +
  [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase()

const paint = (p) => {
  if (p.visible === false) return null
  if (p.type === 'SOLID') {
    const a = p.opacity !== undefined && p.opacity !== 1 ? `@${p.opacity.toFixed(2)}` : ''
    return hex(p.color) + a
  }
  if (p.type === 'IMAGE') return `IMG:${(p.imageRef ?? '').slice(0, 8)}`
  if (p.type.startsWith('GRADIENT')) {
    return `${p.type.replace('GRADIENT_', '')}(${(p.gradientStops ?? []).map((s) => hex(s.color)).join('→')})`
  }
  return p.type
}

const describe = (n) => {
  const bits = []
  const fills = (n.fills ?? []).map(paint).filter(Boolean)
  if (fills.length) bits.push(`fill ${fills.join(',')}`)
  const strokes = (n.strokes ?? []).map(paint).filter(Boolean)
  if (strokes.length) bits.push(`stroke ${strokes.join(',')}/${n.strokeWeight ?? '?'}`)
  if (n.cornerRadius) bits.push(`r${n.cornerRadius}`)
  if (n.rectangleCornerRadii) bits.push(`r[${n.rectangleCornerRadii.join(' ')}]`)
  if (n.opacity !== undefined && n.opacity !== 1) bits.push(`op${n.opacity.toFixed(2)}`)
  if (n.style) {
    const s = n.style
    bits.push(
      `${s.fontFamily} ${s.fontWeight} ${s.fontSize}/${Math.round(s.lineHeightPx ?? 0)}` +
        (s.letterSpacing ? ` ls${s.letterSpacing.toFixed(1)}` : '') +
        ` ${s.textAlignHorizontal}`,
    )
  }
  if (n.effects?.length) {
    bits.push(n.effects.filter((e) => e.visible !== false).map((e) => e.type).join(','))
  }
  return bits.join(' · ')
}

const print = (n, depth) => {
  if (depth > maxDepth) return
  const b = n.absoluteBoundingBox
  const box = b
    ? `y${Math.round(b.y - oy)} x${Math.round(b.x - ox)} ${Math.round(b.width)}x${Math.round(b.height)}`
    : ''
  const text = n.characters ? `  ${JSON.stringify(n.characters.slice(0, 70))}` : ''
  console.log(
    `${'  '.repeat(depth)}${n.type.padEnd(9)} ${box.padEnd(30)} ${n.name.slice(0, 38).padEnd(38)} ${describe(n)}${text}`,
  )
  for (const c of n.children ?? []) print(c, depth + 1)
}

const asNumbers = args.map(Number)
if (args.length === 2 && asNumbers.every((n) => Number.isFinite(n))) {
  const [from, to] = asNumbers
  const hits = (frame.children ?? []).filter((c) => {
    const y = (c.absoluteBoundingBox?.y ?? 0) - oy
    return y >= from && y <= to
  })
  console.log(`# ${hits.length} top-level nodes in y${from}–${to}\n`)
  for (const h of hits) print(h, 0)
} else {
  const needle = args.join(' ').toLowerCase()
  let found = 0
  const search = (n) => {
    if (n.name?.toLowerCase().startsWith(needle)) {
      print(n, 0)
      console.log('')
      found++
      return
    }
    for (const c of n.children ?? []) search(c)
  }
  search(frame)
  if (!found) console.error(`no node whose name starts with "${args.join(' ')}"`)
}
