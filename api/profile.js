export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-request-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
        // Direct Download Header
        res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_profile.jpg"');
      } else {
        // Inline Display Header (Browser Preview)
        res.setHeader('Content-Disposition', 'inline');
      }

      return res.status(200).send(buffer);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Helper Function: Number Clean up & Upstream Processing
  const processNumber = async (inputNumber) => {
    // Sirf digits filter out karein (+ ya spaces remove karne ke liye)
    const cleanNumber = String(inputNumber).replace(/\D/g, '');
    
    if (!cleanNumber) {
      throw new Error('Invalid phone number provided');
    }

    const waUrl = `https://wa.me/${cleanNumber}`;

    const upstreamRes = await fetch('https://whatsapp-dp.faizankhichi.me/api/profile', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-token': '31ca64747f4edb0a308f938f030698e6ce514b9bb54daae07fe2c91e1ea2a695'
      },
      body: JSON.stringify({ url: waUrl })
    });

    const rawData = await upstreamRes.json();

    if (rawData.success && rawData.data) {
      const originalDp = rawData.data.profilePicture;

      // Masked Domain Links
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
          number: rawData.data.phone || `+${cleanNumber}`,
          profileDp: viewDpUrl,            // Browser me OPEN/PREVIEW hoga
          downloadDpLink: downloadDpUrl    // Direct DOWNLOAD hoga
        }
      };
    }

    return { success: false, error: 'Profile not found or private' };
  };

  // 2. GET METHOD (Direct Browser URL Testing with ?number=...)
  if (req.method === 'GET' && req.query.number) {
    try {
      const result = await processNumber(req.query.number);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // 3. POST METHOD (Payload with {"number": "923097508053"})
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const targetNumber = body?.number || body?.phone;

      if (!targetNumber) {
        return res.status(400).json({ success: false, error: 'Phone number parameter is required' });
      }

      const result = await processNumber(targetNumber);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
