import { memo, useCallback, useEffect, useRef, useState } from 'react'
import styles from './ThoughtGalaxy.module.css'

const INITIAL_NODES = [
  { id: 'user', label: 'User', x: 260, y: 180, vx: 0, vy: 0, fixed: true },
  { id: 'programming', label: 'Programming', x: 120, y: 110, vx: 0, vy: 0 },
  { id: 'ai', label: 'AI', x: 365, y: 105, vx: 0, vy: 0 },
  { id: 'math', label: 'Math', x: 420, y: 245, vx: 0, vy: 0 },
  { id: 'basketball', label: 'Basketball', x: 120, y: 250, vx: 0, vy: 0 },
  { id: 'debate', label: 'Debate', x: 260, y: 305, vx: 0, vy: 0 },
  { id: 'python', label: 'Python', x: 205, y: 80, vx: 0, vy: 0 },
  { id: 'research', label: 'Research', x: 335, y: 295, vx: 0, vy: 0 },
]

const LINKS = [
  ['user', 'programming'],
  ['user', 'ai'],
  ['user', 'math'],
  ['user', 'basketball'],
  ['user', 'debate'],
  ['programming', 'python'],
  ['ai', 'python'],
  ['debate', 'research'],
  ['ai', 'research'],
]

function ThoughtGalaxy() {
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const dragIdRef = useRef('')
  const svgRef = useRef(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNodes((current) => stepSimulation(current, dragIdRef.current))
    }, 64)

    return () => window.clearInterval(timer)
  }, [])

  const handlePointerDown = useCallback((event, nodeId) => {
    dragIdRef.current = nodeId
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = useCallback((event) => {
    if (!dragIdRef.current || !svgRef.current) {
      return
    }

    const point = toSvgPoint(event, svgRef.current)
    setNodes((current) => current.map((node) => (
      node.id === dragIdRef.current
        ? { ...node, x: point.x, y: point.y, vx: 0, vy: 0 }
        : node
    )))
  }, [])

  const handlePointerUp = useCallback(() => {
    dragIdRef.current = ''
  }, [])

  return (
    <section className={styles.card} aria-label="Thought galaxy">
      <div className={styles.header}>
        <span>Thought Galaxy</span>
        <strong>Drag nodes</strong>
      </div>

      <svg
        className={styles.galaxy}
        ref={svgRef}
        viewBox="0 0 520 360"
        role="img"
        aria-label="Knowledge graph centered on the user"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {LINKS.map(([sourceId, targetId]) => {
          const source = nodes.find((node) => node.id === sourceId)
          const target = nodes.find((node) => node.id === targetId)
          if (!source || !target) {
            return null
          }

          return (
            <line
              className={styles.link}
              key={`${sourceId}-${targetId}`}
              x1={source.x}
              x2={target.x}
              y1={source.y}
              y2={target.y}
            />
          )
        })}

        {nodes.map((node) => (
          <g
            className={`${styles.node} ${node.id === 'user' ? styles.center : ''}`}
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
            onPointerDown={(event) => handlePointerDown(event, node.id)}
          >
            <circle r={node.id === 'user' ? 27 : 21} />
            <text textAnchor="middle" y={node.id === 'user' ? 4 : 32}>
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </section>
  )
}

function stepSimulation(nodes, draggedId) {
  const next = nodes.map((node) => ({ ...node }))
  const byId = new Map(next.map((node) => [node.id, node]))

  for (let index = 0; index < next.length; index += 1) {
    for (let inner = index + 1; inner < next.length; inner += 1) {
      const first = next[index]
      const second = next[inner]
      const dx = second.x - first.x
      const dy = second.y - first.y
      const distance = Math.max(24, Math.hypot(dx, dy))
      const force = 820 / (distance * distance)
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force

      if (!first.fixed && first.id !== draggedId) {
        first.vx -= fx
        first.vy -= fy
      }
      if (!second.fixed && second.id !== draggedId) {
        second.vx += fx
        second.vy += fy
      }
    }
  }

  LINKS.forEach(([sourceId, targetId]) => {
    const source = byId.get(sourceId)
    const target = byId.get(targetId)
    if (!source || !target) {
      return
    }

    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const desired = sourceId === 'user' ? 125 : 92
    const force = (distance - desired) * 0.006
    const fx = (dx / distance) * force
    const fy = (dy / distance) * force

    if (!source.fixed && source.id !== draggedId) {
      source.vx += fx
      source.vy += fy
    }
    if (!target.fixed && target.id !== draggedId) {
      target.vx -= fx
      target.vy -= fy
    }
  })

  return next.map((node) => {
    if (node.fixed) {
      return { ...node, x: 260, y: 180, vx: 0, vy: 0 }
    }

    if (node.id === draggedId) {
      return node
    }

    const vx = (node.vx + (260 - node.x) * 0.001) * 0.86
    const vy = (node.vy + (180 - node.y) * 0.001) * 0.86

    return {
      ...node,
      vx,
      vy,
      x: Math.min(486, Math.max(34, node.x + vx)),
      y: Math.min(326, Math.max(34, node.y + vy)),
    }
  })
}

function toSvgPoint(event, svg) {
  const rect = svg.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * 520,
    y: ((event.clientY - rect.top) / rect.height) * 360,
  }
}

export default memo(ThoughtGalaxy)
