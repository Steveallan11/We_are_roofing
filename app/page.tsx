export const dynamic = 'force-static'

export default function HomePage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1>?? We Are Roofing OS</h1>
      <p>If you see this, the app is working!</p>
      <p>Environment: {process.env.NODE_ENV}</p>
    </div>
  )
}
