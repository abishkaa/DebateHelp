import { memo, useCallback, useMemo, useState } from 'react'
import styles from './DecisionTournament.module.css'

const MATCHES = [
  {
    id: 'framework',
    left: 'React',
    right: 'Vue',
  },
  {
    id: 'backend',
    left: 'FastAPI',
    right: 'Django',
  },
]

function DecisionTournament() {
  const [winners, setWinners] = useState({})
  const [finalWinner, setFinalWinner] = useState('')

  const finalists = useMemo(
    () => MATCHES.map((match) => winners[match.id]).filter(Boolean),
    [winners],
  )

  const chooseWinner = useCallback((matchId, value) => {
    setWinners((current) => ({ ...current, [matchId]: value }))
    setFinalWinner('')
  }, [])

  const recommendation = finalWinner
    ? `${finalWinner} wins the tournament. Build around it first, then integrate the runner-up only if it reduces complexity.`
    : 'Select winners to generate a final recommendation.'

  return (
    <section className={styles.card} aria-label="Decision tournament">
      <div className={styles.header}>
        <span>Decision Tournament</span>
        <strong>{finalWinner || 'Awaiting final'}</strong>
      </div>

      <div className={styles.bracket}>
        <div className={styles.round}>
          {MATCHES.map((match) => (
            <div className={styles.match} key={match.id}>
              {[match.left, match.right].map((option) => (
                <button
                  className={winners[match.id] === option ? styles.winner : ''}
                  key={option}
                  type="button"
                  onClick={() => chooseWinner(match.id, option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.connector} aria-hidden="true" />

        <div className={styles.round}>
          <div className={styles.match}>
            {(finalists.length === 2 ? finalists : ['Winner A', 'Winner B']).map((option) => (
              <button
                className={finalWinner === option ? styles.winner : ''}
                disabled={finalists.length !== 2}
                key={option}
                type="button"
                onClick={() => setFinalWinner(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className={styles.recommendation}>{recommendation}</p>
    </section>
  )
}

export default memo(DecisionTournament)
