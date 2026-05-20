import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3000

app.use(express.static(join(__dirname, 'public')))

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════╗')
  console.log('  ║   Apothical — Trade Planner          ║')
  console.log('  ║   http://localhost:' + PORT + '               ║')
  console.log('  ╚══════════════════════════════════════╝')
  console.log('')
  console.log('  Ouvre http://localhost:' + PORT + ' dans Chrome')
  console.log('  Ctrl+C pour arrêter')
  console.log('')
})
