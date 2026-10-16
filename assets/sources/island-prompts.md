# Prompt cho các đảo

Năm bộ prompt cho Bài, Cờ, Sự kiện, Hành động và Sắp có. Dùng ảnh đảo Bài đã duyệt làm ảnh tham
chiếu phong cách khi tạo ảnh mới: cùng góc nhìn, độ lớn trong khung, màu và mức chi tiết. Chọn
frame trong clip gốc có đảo rõ nét, không dùng ảnh chụp cả giao diện sảnh làm ảnh tham chiếu.

Mỗi đảo có hai prompt độc lập để sao chép: tạo ảnh trước, rồi dùng chính ảnh đã duyệt làm đầu
vào image-to-video. Prompt viết bằng tiếng Anh để đưa trực tiếp vào công cụ tạo ảnh/video.

- Dùng ảnh ngang 16:9 và xuất video cùng tỉ lệ; không dùng chế độ tự crop để lấp đầy khung.
  Đảo ở giữa, giữ nguyên tỉ lệ hình; toàn bộ chiều cao đảo chiếm khoảng 72% chiều cao khung.
- Toàn bộ đảo, tán cây, cột cờ, dây leo và thác nước phải nằm trong khung ở mọi thời điểm. Chừa
  ít nhất 14% chiều cao khung làm nền trống ở phía trên và phía dưới; thác nước ngắn, có điểm kết thúc nhìn thấy được.
- Nền magenta phẳng `#FF00FF`, không ánh sáng, bóng, hạt bay hay hiệu ứng trên nền. Nền màu sẽ
  được tách sau; không yêu cầu công cụ vẽ ô caro để giả nền trong suốt.
- Video khoảng 6 giây, camera cố định, chỉ chuyển động chi tiết tại chỗ. Toàn bộ khối đảo đứng
  yên; game tự xử lý chuyển động lên xuống. Nếu công cụ hỗ trợ frame đầu/cuối, đặt
  cùng ảnh đã duyệt vào cả hai. Vẫn cần kiểm tra và xử lý điểm nối sau khi tải clip.
- Giữ ảnh đủ màu, kể cả Sắp có: Godot tự làm nhạt màu, thêm sương và ổ khóa. Không vẽ chữ,
  bảng tên, HUD hoặc ổ khóa vào asset.

## Bài (`bai`)

### Tạo ảnh

```text
Use case: stylized-concept. Create a wide LANDSCAPE 16:9 image-to-video source frame for the card-game island (Bài) of Xóm Đảo. Reference image 1 is the approved card island: preserve its island identity, three-quarter orthographic camera angle, Vietnamese village pavilion with terracotta roof, oversized fan of ivory playing cards as the central landmark, bamboo, leafy trees, blue cloth banner, warm lanterns, stone courtyard, limestone rock underside, hanging vines, and left-side turquoise stream with a short waterfall and visible foamy ending. Reference image 2 establishes the polished hand-painted 2.5D material detail, daylight and landscape composition used by its sibling islands. Render crisp richly detailed foliage, stone and wood, natural full colors, warm upper-left sunlight, soft rounded dimensional forms. Keep the cards upright, stationary and distinct, with simple red heart/diamond and black spade/club suit markings. No readable words or numbers required.

Output one wide landscape 16:9 composition. Center the entire compact island without stretching its proportions. Its complete height including tallest foliage, hanging vines, entire rocky underside and waterfall ending should occupy only 72 percent of frame height. At least 14 percent empty magenta above and below, and very generous empty magenta on both sides. Make entire island inside the frame. Keep every extremity visible. Perfectly flat solid unlit #FF00FF background to every edge. Exclude the first reference's airborne leaves, sparkles and background artifacts. All leaves remain attached. All light, glow and shadows confined to objects on the island. No sky, clouds, horizon, floor, black bars, gradients, floating particles, interface, labels, border or watermark. Still source frame for a calm idle loop, entire island fixed in place.
```

### Image-to-video

```text
Locked-off orthographic camera. Animate the supplied card-game island as a quiet six-second idle loop. Preserve its original composition, painting style, geometry, colors and lighting.

Make entire island inside the frame. Keep every treetop, banner pole, hanging vine and the full waterfall visible throughout, with generous empty padding on all sides. Keep the original 16:9 framing, constant apparent size and camera angle. Lock the rock base, ground, pavilion and playing cards to identical screen coordinates in every frame.

Water flows steadily down the stream and waterfall, with delicate foam confined to its visible ending. Tree and bamboo leaves sway slightly, with all leaves attached. The blue cloth banner softly ripples from its fixed support. Hanging lanterns sway very subtly from fixed strings and maintain steady warm light.

The entire rock island remains anchored at exactly the same screen position throughout. No up-and-down movement, bobbing, hovering motion, drifting, rotation, rocking, zooming or scaling of the island as a whole. The playing cards remain completely rigid and stationary: preserve their exact count, fan arrangement, suit markings and positions. The pavilion, rocks, paths and wooden structures remain unchanged.

The background stays perfectly uniform solid magenta #FF00FF in every frame, with constant color and brightness. Keep the surrounding padding empty: no clouds, airborne leaves, particles or new objects. Camera position, framing, focus and exposure stay fixed. All animated details return to their starting pose and motion phase at the end for a seamless loop. One continuous shot with only local environmental idle motion.
```

## Cờ (`co`)

### Tạo ảnh

```text
Create one isolated floating island for the board-game category of Xóm Đảo, matching the supplied approved card-island reference in art style, camera angle, scale, lighting and detail density.

A charming Vietnamese village garden built on an asymmetrical floating limestone island. At the focal point, a large ivory stone xiangqi board with clean engraved grid lines rests on a low carved stone table. Several oversized round ivory playing pieces with simple red and charcoal circular inlays make the board readable at a small size. The pieces have plain faces without lettering. A small terracotta-tiled pavilion sits behind the board, framed by bamboo, a broad leafy tree and weathered limestone outcrops. A lacquer-red cloth banner, warm lanterns, a curved flagstone path, low timber fencing, ferns and trailing vines complete the scene. A turquoise stream follows the left side and spills over the front-left edge into a short waterfall with a visible foamy ending.

Richly detailed hand-painted 2.5D fantasy game illustration, dimensional forms, soft rounded edges, layered foliage, natural stone and wood textures, warm sunlight from the upper left and soft contact shadows. Three-quarter orthographic view from slightly above. Clear central focal point and a coherent, compact silhouette.

Make the entire island fit inside the frame, including all foliage, banner poles, dangling vines and the complete waterfall. Output a wide landscape 16:9 frame. Center the island without stretching it. Its complete height, from the highest foliage to the lowest rock, vine or waterfall foam, occupies only 72 percent of frame height. Leave at least 14 percent empty magenta above and below, and generous empty space on both sides. No black bars or automatic fill-cropping.

Perfectly uniform, flat, unlit solid magenta background, exact #FF00FF. All lighting and shadows stay on the island. Clean compositing separation. No sky, clouds, horizon, floor, distant islands, background effects, detached particles, text, numbers, interface, labels, border or watermark.
```

### Image-to-video

```text
Locked-off orthographic camera. Animate the supplied board-game island as a quiet six-second idle loop. Preserve its original composition, painting style, geometry, colors and lighting.

Make entire island inside the frame. Keep every treetop, banner pole, hanging vine and the full waterfall visible throughout the video, with generous empty padding on all sides. Keep the original 16:9 framing, a constant apparent size and camera angle. Lock the rock base, buildings and ground to identical screen coordinates in every frame; only the small environmental details described below animate.

Water flows steadily down the stream and waterfall, with gentle foam confined to the waterfall's visible ending. Bamboo leaves and the tree canopy sway slightly. The red cloth banner softly ripples between its fixed attachment points. Hanging vines move very subtly. The entire rock island remains anchored at exactly the same screen position throughout. No up-and-down movement, bobbing, hovering motion, drifting, rotation, rocking, zooming or scaling of the island as a whole.

The stone board, engraved grid, playing pieces, pavilion and lantern structures remain rigid and unchanged. The playing pieces stay in their exact positions. All leaves remain attached to their branches.

The background stays perfectly uniform solid magenta #FF00FF in every frame, with constant color and brightness. Keep the surrounding padding empty and clean. Camera position, framing, focus and exposure stay fixed. All moving elements return to their starting pose and motion phase at the end for a seamless loop. One continuous shot, with movement confined to the island.
```

## Sự kiện (`su-kien`)

### Tạo ảnh

```text
Create one isolated floating island for the festival-events category of Xóm Đảo, matching the supplied approved card-island reference in art style, camera angle, scale, lighting and detail density.

A cheerful Vietnamese village festival courtyard on an asymmetrical floating limestone island. A large handcrafted five-point star lantern with a bamboo frame and warm amber paper panels is the central landmark. Strings of red and honey-gold lanterns hang between curved bamboo poles around a small terracotta-roofed communal pavilion. A low wooden table holds a tea set and a small tray of golden mooncakes. A flowering tree, bamboo, leafy shrubs, white flowers, sandstone steps, moss and hanging vines frame the courtyard. A turquoise stream curves along the left edge and ends in a short waterfall with a visible foamy ending. Keep the lantern glow warm and local to the lanterns, while the scene remains bright daylight.

Richly detailed hand-painted 2.5D fantasy game illustration, dimensional forms, soft rounded edges, layered foliage, natural stone and wood textures, warm sunlight from the upper left and soft contact shadows. Three-quarter orthographic view from slightly above. The large star lantern is immediately readable at a small size. Warm festive accents balanced with lush natural greens.

Make the entire island fit inside the frame, including every lantern, bamboo pole, treetop, hanging vine and the complete waterfall. Output a wide landscape 16:9 frame. Center the island without stretching it. Its complete height, from the highest foliage to the lowest rock, vine or waterfall foam, occupies only 72 percent of frame height. Leave at least 14 percent empty magenta above and below, and generous empty space on both sides. No black bars or automatic fill-cropping.

Perfectly uniform, flat, unlit solid magenta background, exact #FF00FF. All lighting, lantern glow and shadows stay on the island. Clean compositing separation. No sky, clouds, horizon, floor, distant islands, fireworks, confetti, floating sparkles, background effects, text, numbers, interface, labels, border or watermark.
```

### Image-to-video

```text
Locked-off orthographic camera. Animate the supplied Vietnamese festival island as a quiet six-second idle loop. Preserve its original composition, painting style, geometry, colors and lighting.

Make entire island inside the frame. Keep every lantern, bamboo pole, treetop, hanging vine and the full waterfall visible throughout the video, with generous empty padding on all sides. Keep the original 16:9 framing, a constant apparent size and camera angle. Lock the rock base, buildings and ground to identical screen coordinates in every frame; only the small environmental details described below animate.

The hanging lanterns sway softly from their fixed strings, with a small, natural pendulum motion. Their warm light remains steady. The large star lantern and its support remain fixed in place. Tree leaves and bamboo sway gently, with all leaves attached. Water flows continuously down the stream and waterfall, with delicate foam confined to its visible ending. The entire rock island remains anchored at exactly the same screen position throughout. No up-and-down movement, bobbing, hovering motion, drifting, rotation, rocking, zooming or scaling of the island as a whole.

The pavilion, bamboo supports, table, tea set and mooncakes remain rigid and unchanged. Keep the atmosphere calm and festive, with all movement attached to the island.

The background stays perfectly uniform solid magenta #FF00FF in every frame, with constant color and brightness. Keep the surrounding padding empty and clean. Camera position, framing, focus and exposure stay fixed. All moving elements return to their starting pose and motion phase at the end for a seamless loop. One continuous shot.
```

## Hành động (`hanh-dong`)

### Tạo ảnh

```text
Create one isolated floating island for the playful action-games category of Xóm Đảo, matching the supplied approved card-island reference in art style, camera angle, scale, lighting and detail density.

A lively Vietnamese coastal adventure outpost on an asymmetrical floating limestone island. A single oversized, friendly cartoon bomb with a rounded charcoal-blue body and a short curved rope fuse stands on a low circular stone platform at the center. A tiny warm golden ember sits at the fuse tip. Surround the platform with a few honey-colored wooden crates, rope-bound barrels, a small terracotta-roofed shelter, a rust-red pennant, low wooden fencing and a winding sandstone path. A curved palm and a broad leafy tree balance the silhouette. Add ferns, moss, tiny white flowers and vines along the rocky rim. A turquoise stream along the left edge feeds a short waterfall with a visible foamy ending. The mood is adventurous, charming and playful.

Richly detailed hand-painted 2.5D fantasy game illustration, dimensional forms, soft rounded edges, layered foliage, natural stone and wood textures, warm sunlight from the upper left and soft contact shadows. Three-quarter orthographic view from slightly above. The large cartoon bomb is the clear focal point, surrounded by a compact, carefully arranged village diorama.

Make the entire island fit inside the frame, including the palm fronds, pennant, bomb fuse, hanging vines and the complete waterfall. Output a wide landscape 16:9 frame. Center the island without stretching it. Its complete height, from the highest foliage to the lowest rock, vine or waterfall foam, occupies only 72 percent of frame height. Leave at least 14 percent empty magenta above and below, and generous empty space on both sides. No black bars or automatic fill-cropping.

Perfectly uniform, flat, unlit solid magenta background, exact #FF00FF. All lighting, ember glow and shadows stay on the island. Clean compositing separation. No sky, clouds, horizon, floor, distant islands, smoke, explosions, flying debris, background effects, text, numbers, interface, labels, border or watermark.
```

### Image-to-video

```text
Locked-off orthographic camera. Animate the supplied playful action-game island as a quiet six-second idle loop. Preserve its original composition, painting style, geometry, colors and lighting.

Make entire island inside the frame. Keep the full palm canopy, pennant, bomb fuse, hanging vines and the complete waterfall visible throughout the video, with generous empty padding on all sides. Keep the original 16:9 framing, a constant apparent size and camera angle. Lock the rock base, buildings and ground to identical screen coordinates in every frame; only the small environmental details described below animate.

The tiny ember at the fuse tip softly pulses between warm amber and pale gold. The fuse remains the same length and the bomb remains intact and stationary throughout. Palm fronds and tree leaves sway gently, with all leaves attached. The rust-red pennant softly ripples from its fixed support. Water flows steadily down the stream and waterfall, with delicate foam confined to its visible ending. The entire rock island remains anchored at exactly the same screen position throughout. No up-and-down movement, bobbing, hovering motion, drifting, rotation, rocking, zooming or scaling of the island as a whole.

The bomb body, stone platform, crates, barrels, fencing and shelter stay rigid and retain their exact shapes and positions. Keep the action at a calm idle state, with the ember confined to the fuse tip and the surrounding air clear.

The background stays perfectly uniform solid magenta #FF00FF in every frame, with constant color and brightness. Keep the surrounding padding empty and clean. Camera position, framing, focus and exposure stay fixed. All moving elements return to their starting pose and motion phase at the end for a seamless loop. One continuous shot.
```

## Sắp có (`sap-co`)

Đây là đảo giữ chỗ, không phải một thể loại. Bản art vẫn đủ màu, không có chữ hay ổ khóa;
sảnh sẽ thêm trạng thái khóa bằng code.

### Tạo ảnh

```text
Create one isolated floating island for an unopened destination in Xóm Đảo, matching the supplied approved card-island reference in art style, camera angle, scale, lighting and detail density.

A quiet, secluded Vietnamese village gateway on an asymmetrical floating limestone island. A closed honey-brown wooden double gate between two weathered stone pillars is the central landmark, topped by a modest terracotta-tiled lintel. A short, slightly overgrown sandstone path leads to the gate. Mossy boulders, a small bamboo grove, one windswept leafy tree, low ferns, tufts of grass and hanging vines create a peaceful sense of a destination waiting to open. Keep the courtyard sparsely decorated and the gate easy to recognize at a small size. A narrow turquoise stream spills over the left edge into a short waterfall with a visible foamy ending.

Richly detailed hand-painted 2.5D fantasy game illustration, dimensional forms, soft rounded edges, layered foliage, natural stone and wood textures, warm sunlight from the upper left and soft contact shadows. Three-quarter orthographic view from slightly above. Render the island in full natural color, with the same daylight and material richness as the approved card island.

Make the entire island fit inside the frame, including the gate, tree canopy, bamboo, hanging vines and the complete waterfall. Output a wide landscape 16:9 frame. Center the island without stretching it. Its complete height, from the highest foliage to the lowest rock, vine or waterfall foam, occupies only 72 percent of frame height. Leave at least 14 percent empty magenta above and below, and generous empty space on both sides. No black bars or automatic fill-cropping.

Perfectly uniform, flat, unlit solid magenta background, exact #FF00FF. All lighting and shadows stay on the island. Clean compositing separation. No sky, clouds, horizon, floor, distant islands, fog, padlock, chains, floating particles, background effects, text, numbers, interface, labels, border or watermark.
```

### Image-to-video

```text
Locked-off orthographic camera. Animate the supplied unopened-destination island as a quiet six-second idle loop. Preserve its original composition, painting style, geometry, full natural colors and lighting.

Make entire island inside the frame. Keep the entire gate, tree canopy, bamboo, hanging vines and the complete waterfall visible throughout the video, with generous empty padding on all sides. Keep the original 16:9 framing, a constant apparent size and camera angle. Lock the rock base, buildings and ground to identical screen coordinates in every frame; only the small environmental details described below animate.

The tree canopy and bamboo leaves sway gently in a light breeze, with all leaves remaining attached. Hanging vines move very slightly. Water flows steadily down the narrow stream and waterfall, with delicate foam confined to its visible ending. The entire rock island remains anchored at exactly the same screen position throughout. No up-and-down movement, bobbing, hovering motion, drifting, rotation, rocking, zooming or scaling of the island as a whole.

The wooden gate stays completely closed and stationary. The pillars, tiled lintel, path and rocks remain rigid and unchanged. Keep the island in full color and the surrounding air clear; the game interface will supply its own locked-state treatment.

The background stays perfectly uniform solid magenta #FF00FF in every frame, with constant color and brightness. Keep the surrounding padding empty and clean. Camera position, framing, focus and exposure stay fixed. All moving elements return to their starting pose and motion phase at the end for a seamless loop. One continuous shot.
```

Ảnh PNG 16:9 tạo lại để dùng cho video idle tại chỗ: [thư mục island-video](../shared/images/island-video/README.md).
