export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-request-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Domain Protocol & Host Detection
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  // 1. IMAGE PROXY ROUTE (View or Download Image)
  if (req.method === 'GET' && req.query.img) {
    try {
      const imageUrl = decodeURIComponent(req.query.img);
      const isDownload = req.query.dl === '1';

      const imgResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (!imgResponse.ok) {
        return res.status(400).json({ success: false, error: 'Failed to fetch image' });
      }

      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imgResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

      if (isDownload) {
        // Direct Download
        res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_profile.jpg"');
      } else {
        // Inline Display (Browser view)
        res.setHeader('Content-Disposition', 'inline');
      }

      return res.status(200).send(buffer);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Function to process target URL
  const processProfile = async (targetUrl) => {
    const upstreamRes = await fetch('[https://whatsapp-dp.faizankhichi.me/api/profile](https://whatsapp-dp.faizankhichi.me/api/profile)', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-token': '31ca64747f4edb0a308f938f030698e6ce514b9bb54daae07fe2c91e1ea2a695'
      },
      body: JSON.stringify({ url: targetUrl })
    });

    const rawData = await upstreamRes.json();

    if (rawData.success && rawData.data) {
      const originalDp = rawData.data.profilePicture;

      // Custom Masked Links
      const viewDpUrl = originalDp 
        ? `${baseUrl}/api/profile?img=${encodeURIComponent(originalDp)}` 
        : null;

      const downloadDpUrl = originalDp 
        ? `${baseUrl}/api/profile?img=${encodeURIComponent(originalDp)}&dl=1` 
        : null;

      return {
        success: true,
        data: {
          name: rawData.data.name || "Unknown",
          number: rawData.data.phone || "",
          profileDp: viewDpUrl,             // Browser me photo SHOW hogi
          downloadDpLink: downloadDpUrl     // Browser me DIRECT DOWNLOAD hogi
        }
      };
    }

    return { success: false, error: 'Profile not found or private' };
  };

  // 2. POST METHOD (Standard API Call)
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !body.url) {
        return res.status(400).json({ success: false, error: 'Target URL is required' });
      }

      const result = await processProfile(body.url);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 3. GET METHOD (Browser Testing Support)
  // Usage in browser: [https://your-app.vercel.app/api/profile?url=https://wa.me/923097508053](https://your-app.vercel.app/api/profile?url=https://wa.me/923097508053)
  if (req.method === 'GET' && req.query.url) {
    try {
      const result = await processProfile(req.query.url);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
