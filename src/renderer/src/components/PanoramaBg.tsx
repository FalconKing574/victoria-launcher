import p0 from '../assets/panorama/panorama_0.jpg'
import p1 from '../assets/panorama/panorama_1.jpg'
import p2 from '../assets/panorama/panorama_2.jpg'
import p3 from '../assets/panorama/panorama_3.jpg'
import p4 from '../assets/panorama/panorama_4.jpg'
import p5 from '../assets/panorama/panorama_5.jpg'
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

export interface PanoramaBgProps {
  /** How hard to darken the scene. Higher suits screens with dense content. */
  dim?: number
}

/**
 * The blur is baked into the source images rather than applied with
 * backdrop-filter: blurring a full-screen overlay forced Chromium to read back
 * and re-blur the composited backdrop on every frame of the rotation, which was
 * the single most expensive thing the app did.
 */
export default function PanoramaBg({ dim = 0.72 }: PanoramaBgProps): JSX.Element {
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
      <div
        className="panorama-veil"
        style={{
          background:
            `radial-gradient(120% 90% at 50% 0%, rgba(7,7,11,${dim * 0.35}), rgba(7,7,11,${dim}) 78%),` +
            `linear-gradient(180deg, rgba(30,58,138,0.10), rgba(7,7,11,${dim * 0.85}))`
        }}
      />
    </div>
  )
}
