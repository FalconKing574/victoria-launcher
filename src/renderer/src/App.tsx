import TitleBar from './components/TitleBar'
import PanoramaBg from './components/PanoramaBg'
import GlassCard from './components/GlassCard'
import Button from './components/Button'

export default function App(): JSX.Element {
  return (
    <>
      <PanoramaBg />
      <div style={{ position: 'relative', zIndex: 10, height: '100vh' }}>
        <TitleBar />
        <div style={{ display: 'grid', placeItems: 'center', height: 'calc(100vh - 38px)' }}>
          <GlassCard style={{ width: 360 }}>
            <h2 style={{ marginTop: 0 }}>Victoria Kingdom</h2>
            <Button full>JUGAR</Button>
          </GlassCard>
        </div>
      </div>
    </>
  )
}
