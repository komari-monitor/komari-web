import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import './index.css'

const root = createRoot(document.getElementById('root')!)

root.render(
  <BrowserRouter>
    <StrictMode>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StrictMode>
  </BrowserRouter>
)

function Home() {
  return <h1>Home</h1>
}

function About() {
  return <h1>About</h1>
}

function NotFound() {
  return <h1>404 Not Found</h1>
}
