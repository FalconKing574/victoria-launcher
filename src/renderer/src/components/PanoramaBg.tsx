import p0 from '../assets/panorama/panorama_0.png'
import p1 from '../assets/panorama/panorama_1.png'
import p2 from '../assets/panorama/panorama_2.png'
import p3 from '../assets/panorama/panorama_3.png'
import p4 from '../assets/panorama/panorama_4.png'
import p5 from '../assets/panorama/panorama_5.png'
import './panorama.css'

/**
 * Minecraft panorama face order: 0 front, 1 right, 2 back, 3 left, 4 top, 5 bottom.
 */
const FACES: Array<{ src: string; transform: string }> = [
  { src: p0, transform: 'rotateY(0deg) translateZ(-50vmax)' },
  { src: p1, transform: 'rotateY(-90deg) translateZ(-50vmax)' },
  { src: p2, transform: 'rotateY(180deg) translateZ(-50vmax)' },
  { src: p3, transform: 'rotateY(90deg) translateZ(-50vmax)' },
  { src: p4, transform: 'rotateX(-90deg) translateZ(-50vmax)' },
  { src: p5, transform: 'rotateX(90deg) translateZ(-50vmax)' }
]

export default function PanoramaBg({ blur = 8 }: { blur?: number }): JSX.Element {
  return (
    <div className="panorama-root" aria-hidden="true">
      <div className="panorama-stage">
        <div className="panorama-cube">
          {FACES.map((face, index) => (
            <div
              key={index}
              className="panorama-face"
              style={{ transform: face.transform, backgroundImage: `url(${face.src})` }}
            />
          ))}
        </div>
      </div>
      <div className="panorama-veil" style={{ backdropFilter: `blur(${blur}px)` }} />
    </div>
  )
}
