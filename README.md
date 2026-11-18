# BlockMotion Studio

A working **browser-based, procedural Roblox-style animation editor**. No Blender, FBX, GLB, or external character model is required. The R6-style avatar, studio, camera, scene objects, and lighting are constructed in code using Three.js.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Build for deployment:

```bash
npm run build
npm run preview
```

The `dist/` directory can be published as a static site (Netlify, Vercel, GitHub Pages with correct base, etc.). **No backend is required**.

## Deploy with GitHub Actions via FTP

`.github/workflows/deploy.yml` typechecks and builds on GitHub using Node.js 22,
then uploads `dist/` via FTP on every push to `main`. You can also run **Actions →
Deploy via FTP → Run workflow** on `main`. Use the FTP account from **cPanel →
FTP Accounts**. The hosting account does not need SSH, rsync, or Node.js.

In the GitHub repository, open **Settings → Secrets and variables → Actions**.
Add these repository **Secrets**:

| Secret | Value |
| --- | --- |
| `FTP_SERVER` | FTP hostname or IP, without `ftp://` or a path |
| `FTP_USERNAME` | Full FTP username shown in cPanel, e.g. `deploy@example.com` |
| `FTP_PASSWORD` | Password for that FTP account |

Add these repository **Variables** in the same settings page:

| Variable | Value |
| --- | --- |
| `FTP_SERVER_DIR` | Required destination as seen after FTP login, ending in `/` |
| `FTP_PORT` | Optional; defaults to `21` |
| `FTP_PROTOCOL` | Optional; defaults to `ftp`. Use `ftps` if the host supports explicit FTP over TLS. |
| `VITE_BASE_PATH` | Optional; defaults to `/blockmotion/`. Use `/` for a domain or subdomain root. |

Choose `FTP_SERVER_DIR` relative to the FTP account's login directory:

- Account rooted at `/home/USERNAME`: use `public_html/blockmotion/`.
- Account rooted at `/home/USERNAME/public_html`: use `blockmotion/`.
- Account restricted to `/home/USERNAME/public_html/blockmotion`: use `./`.

The default base URL matches `https://YOUR_DOMAIN/blockmotion/`. Match the FTP
directory and base URL to the actual document root. The workflow installs `lftp`
on the GitHub runner and uses `.github/scripts/deploy-ftp.sh` to upload in passive
IPv4 mode, preferring PASV instead of EPSV to work around connection resets with
the hosting's ProFTPD server. Transfers run sequentially with bounded retries.
FTPS is limited to TLS 1.2 as a workaround for the
[ProFTPD TLS 1.3 data-transfer bug](https://github.com/proftpd/proftpd/issues/2416)
that can produce `gnutls_record_recv: Error in parsing` with older server OpenSSL
versions. Both control and data connections remain encrypted when using FTPS.
It uploads assets before `index.html`, keeps existing remote files, and does not
use `.ftp-deploy-sync-state.json`. Use a directory dedicated to this app.

The previously authorized certificate workaround remains enabled through
`ssl:verify-certificate no`. FTPS encrypts the connection but does not verify the
server's identity with this setting. Change it to `yes` after the hosting provider
repairs the certificate chain. If PASV transfers still fail, ask the hosting
provider to check the passive port range and firewall; this client change cannot
open blocked server ports.

Commit and push the workflow and application files after configuring the secrets
and variables. This workflow uploads built files directly and does not use
`.cpanel.yml` or the server's Git checkout. Avoid running both deployment methods
for the same site.

The deployment gate is `npm run build`, which includes TypeScript checks. It does
not run `npm test`: the current suite fails the camera object's nonempty geometry
assertion in `tests/objects.test.mjs`. Restore a test gate after repairing the suite.

See the [lftp manual](https://lftp.yar.ru/lftp-man.html) for transfer settings.

## Deploy with cPanel Git Version Control

The root `.cpanel.yml` installs dependencies, builds the app, and copies only the
contents of `dist/` to the `DEPLOYPATH` configured in that file (currently
`$HOME/public_html/blockmotion`). It copies files only after a successful
build and leaves unrelated files in the destination in place. Existing files with
matching names (including `index.html`) are overwritten.

1. Keep the cPanel Git checkout outside the public document root, for example
   `/home/USERNAME/repositories/blockmotion-studio`.
2. Check the domain's document root in cPanel. Edit `DEPLOYPATH` in `.cpanel.yml`
   if it differs from `/home/USERNAME/public_html/blockmotion`.
3. Ensure Node.js 20.19+ or 22.12+ and npm are available in the deployment task's
   `PATH`. Some hosts require adding their Node.js binary directory to `PATH` in
   `.cpanel.yml`; ask the host for that path. A browser-only app still needs Node.js
   on the server to build using this configuration.
4. Review and commit the deployment files and all application changes you intend
   to publish, then push to the remote branch cPanel follows. Include new source
   files required by those changes. Keep `dist/` and `node_modules/` ignored.
5. In **Git Version Control → Manage → Pull or Deploy**, select **Update from
   Remote**, then **Deploy HEAD Commit**.

If cPanel reports **The system cannot deploy**, check the repository on the
**cPanel server** (its working tree is separate from your local checkout):

```bash
git status --short
git ls-files .cpanel.yml
```

The first command must print nothing; the second must print `.cpanel.yml`.
Back up and review any server-side changes, then commit intentional changes or
move unintended files outside the checkout before updating from the remote.
Do not discard server changes without reviewing them. A local commit alone does
not clean up a modified server checkout.

This configuration assumes the app is served at the domain root. For a subdirectory
such as `/studio/`, set Vite's `base` to `/studio/` in `vite.config.ts` and deploy to
that subdirectory. If the host cannot run Node.js, build locally with
`npm ci --include=dev && npm run build` and upload the contents of `dist/` to the
domain's document root using cPanel File Manager instead.

See [cPanel's deployment setup guide](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-set-up-deployment/).

## What's included

- A Three.js WebGL viewport with grid, shadows, orbit controls, raycaster-based click selection, transform gizmos, and front/side/top views.
- Procedural R6 male and female characters, each a removable scene node with independent joints: torso, head, two arms, two legs, facial details, editable palette and hierarchical joint pivots.
- Scene Explorer and transform Inspector (position, Euler rotation in degrees, scale).
- Object library with 51 procedural presets, including: Blocky R6 Male/Female, tree, pine tree, bush, rock, road, intersection, store, house, bench, street light, fence, cube, sphere, cylinder, and ground tile. Add up to 500 objects from **Explorer → Add object / Presets**. Select objects in the viewport, hierarchy, or timeline, then move/rotate/scale, rename, recolor, focus, duplicate, or delete them in **Inspector → Object**. Press **K** or **Insert keyframe** to record a transform at the playhead; Auto key records Inspector edits on blur and gizmo edits after dragging. Scrubbing and playback interpolate object tracks with the selected linear, smooth, or step setting. Duplicating an object copies its animation with a position offset. Added objects are automatically framed in the viewport. Changes support undo/redo, autosave and project JSON import/export.
- A multi-track animation timeline with draggable scrubber, selectable and draggable keyframe diamonds, frame stepping, FPS, looping, automatic keyframes, and linear / smooth / step interpolation.
- Preset motions: Wave, Walk, Jump, Idle, Cinematic.
- Procedural Motion generator for R6 characters: generate Walk, Run, Idle, Jump, or Wave with adjustable cycle duration, intensity, and repeats. Walk and Run move the character forward; generated motion supports undo.
  Generated samples use linear interpolation between keys to avoid easing to a stop at each sample. Other animation keeps its project interpolation. Regenerate older procedural clips to apply this behavior.
  Playback updates the playhead independently of the track list and caches static object transforms. The viewport renders at up to 1× pixel density with 1024px shadows, hides editing helpers during playback, and stops redrawing when idle. Screenshots still render immediately before capture.
  **Auto quality** measures active preview FPS and reduces resolution/disables shadows when playback stays below 45 FPS. **Fast preview** immediately uses half resolution without shadows; **Full quality** keeps the maximum preview quality. The FPS readout appears during playback. Preview quality does not change project data or animation timing.
- Editable cinematic camera with its own timeline track; viewport/camera toggle.
- Procedural skybox presets: Morning, Day, Evening, Night, and Custom under **Inspector → Project → Stage Appearance → Skybox**. Custom adjusts sky/horizon colors, sun or moon color, elevation, direction, lighting intensity, and stars. Select a preset then Custom to use it as a starting point. Studio retains the original solid background. Sky settings support undo/redo, autosave, JSON import/export, screenshots, and video recording; older projects retain their original studio appearance. Custom uses procedural colors rather than image/HDRI uploads.
- Undo/redo, local autosave, and project JSON import/export.
- PNG viewport screenshot and browser WebM video recording (when supported by the browser).
- Keyboard shortcuts dialog.

## Quick walkthrough

1. Select a male or female character, then choose **Wave** under Animation Presets or use the preloaded motion. Motion presets affect only the selected character; the Camera preset affects the shot camera.
2. Expand a character in Explorer and select its torso, head, arm, or leg, or click a body part in the viewport. Select its name to transform the whole character.
3. Select Rotate (**R**), Move (**G**), or Scale (**S**). Drag its gizmo or edit numbers in Inspector.
4. Scrub to a desired time; transform the selected object or joint and press **K** to add a keyframe. Auto key is enabled by default.
5. Press **Space** to play the animation; click a diamond on the timeline to select it. Press **Delete** to remove it.
6. Choose **Shot Camera** in Explorer and manipulate it in the viewport. Add camera keyframes at different times; enable **Camera view** to preview them.
7. Click **Save** or **Export → Project JSON** for a reusable file. **Open** imports it. **Record** captures the shot-camera preview as WebM if supported.

## Stack

React 19 + Vite 6 + TypeScript, Three.js 0.180 (`OrbitControls`, `TransformControls`), Zustand 5, Lucide React, and custom CSS. Source is under `src/engine/`, `src/editor/`, and `src/components/`.

## Current MVP limitations

- R6-style procedural block rig, not official Roblox rig files or native `.rbxm` / `.rbxmx` format.
- Linear, smoothstep and step interpolation; no Bézier graph editor, IK solver or skeletal skinning yet.
- Multiple independently animated characters and one cinematic camera. No asset importing or real-time collaboration.
- Every added object has its own timeline track for position, rotation, and scale. Every male and female character has its own torso, head, arms, and legs with independent transform tracks. Characters can be deleted or duplicated together with all their joint animation. There is no permanent main character. Presets are built in code, and external 3D model importing is not available.
- Keyframe rotation is interpolated as shortest-path **per Euler axis**. This is adequate for simple movements but not a substitute for quaternion interpolation for complex 3D rotation.
- Browser MediaRecorder WebM support varies; Safari may not support WebM recording. Export JSON and PNG remain available.
- In-browser autosave uses localStorage (small projects); export JSON backups for portability.

## Privacy

This app is client-side only. It does not upload your animation data to a server. Browser storage stays local unless you export/share files yourself.

## Object editing and checks

- **Delete / Backspace** removes the selected timeline keyframe first; otherwise it removes the selected scene object. Each added object also has a trash button in the hierarchy.
- **Ctrl/Cmd+D** duplicates the selected object. **Ctrl/Cmd+Z** undoes edits and deletions.
- Each character has independent shirt, skin, and pants colors. Older projects migrate the former main character and all its animation into an ordinary deletable character node. Deleted characters stay deleted after reload.
- The object's primary color changes its main surfaces (such as clothing, foliage or walls), preserving detail colors.
- Run `npm test` for object data, animation, geometry, history, persistence, renderer reconciliation, and resource disposal checks. Run `npm run build` for TypeScript and production bundling.

## Reset and delete controls

- **Timeline → Keyframes** resets or deletes the selected diamond, clears the selected node track, clears the selected character's root and joint tracks, or clears every track in the project (including the camera). Cleared tracks return to their base transforms; objects stay in the scene.
- **Inspector → Object** has **Clear node keys** and, for characters, **Clear character keys** and **Reset pose**. Reset pose makes the character's joints neutral at the playhead while preserving the root placement and animation at other times. Auto-key records it in one undo step; with Auto-key off, use **Key pose** to record the preview.
- **Explorer → Delete all** removes every object/character and all keyframes, including camera animation, and returns the playhead to zero. It keeps project settings, sky, camera, lights and stage. It does not add a default character. **New** starts a new project with a default character.
- Every reset or bulk deletion can be undone with **Ctrl/Cmd+Z** and redone with **Ctrl/Cmd+Shift+Z**.

## Town library and grid snap

Choose **Explorer → Add object / Presets → Category: Town**, then filter by **Roads**, **Street props**, **Transport**, **Buildings**, **Park**, or **Details**. Search understands common Indonesian terms such as `trotoar`, `mobil`, `sekolah`, and `spbu`.

The 29 new Town presets are road bend, T junction, sidewalk, sidewalk corner, zebra crossing, parking lot, traffic light, stop sign, road barrier, trash bin, car, motorcycle, bus, bus stop, apartment, office, cafe, school, minimarket, gas station, grass tile, park path, flower pot, fountain, playground, shop sign, billboard, power pole, and mailbox. They join the existing road, intersection, store, house, bench, street light, and fence presets.

- Road segments are 6 units long with a 4-unit carriageway. A road bend connects its north edge to its east edge; the T junction connects north, east, and west. Rotate modules in 90° increments using Inspector.
- **Snap** in the viewport applies to object/camera position edits through the Move gizmo and Inspector. Choose **6 u** to align road centers, or **0.5 u** to position a sidewalk center 2.5 units from a straight road center. Other available steps are **1 u** and **2 u**. Snap stays off for individual character joints.
- All presets support transforms, primary colors, keyframes, duplication, deletion, undo/redo, and project JSON persistence. Vehicle movement can be keyframed as a whole object; traffic lights, fountain water and playground parts are static geometry inside their object, with no built-in simulation or separate part animation.

## Environment generators

Open **Explorer → Environment generator** to create **Town**, **City**, **Mountains**, **Jungle**, or **Desert**:

- Town/City: configure **Blocks X/Z** (1–8 each), **Buildings per block** (1–3), trees/greenery, and street props. Town favors houses and shops; City favors taller apartments and offices. Connected streets and sidewalks form a single efficient road-network node; buildings and greenery remain separate objects.
- Mountains/Jungle/Desert: configure **Area size**, **Terrain/Mountain height**, **Trees** (cacti/palms for Desert), and **Rocks**. Mountains use ridged terrain with mostly pines; Jungle uses rolling terrain, tall trees, palms and undergrowth; Desert uses dunes, cacti, palms and rocks. Plants and rocks sit on the rendered terrain surface.
- Use **Seed** to repeat the layout or the dice button to get a new layout. **Origin X/Z** offsets the generated environment.
- **Add to scene** preserves existing objects; **Replace scene objects** replaces them while keeping project settings and camera animation. The panel previews exact object counts and disables generation over the 500-object limit. A generation is atomic and can be undone/redone in one step.
- Generation automatically frames its result. **Frame result** frames it again. Scene zoom/fog distances expand for large environments.
- Generated objects support transforms, colors, keyframes, duplication, deletion, JSON import/export and autosave. Terrain and road-grid descriptors are stored in the project, so their geometry is rebuilt on reload without external assets.

## Automatic camera cuts

Use **Timeline → Camera cuts** to switch views automatically during playback:

1. Move the playhead to the desired time. Choose **Current view**, **Front/Back/Left/Right/Top/Perspective**, or **Shot Camera**, then click **Cut here**.
2. Add more cuts at other times. **Current view** captures the currently displayed camera. Direction presets capture a fixed view framing the selected object's root, or the whole scene if no object is selected. **Shot Camera** uses the animated camera track continuously.
3. Turn on **Preview cuts** (also available through **Camera view / C**) and press **Play**. At a cut's exact frame the view changes immediately; before the first cut it uses Shot Camera. Scrubbing, looping, PNG export and WebM recording use the same cut selection.
4. Drag camera icons in the **Camera cuts** timeline row to retime them. Click one to select it and edit its time. **Capture view** updates the selected cut from the displayed camera; leave Camera view and orbit the editor first to capture a new angle. Delete with the selected-cut trash button or **Delete/Backspace**. The toolbar trash button clears all cuts.

Cuts support undo/redo, autosave and JSON import/export. A cut added at an existing frame replaces it; moving a cut onto another cut replaces the destination. Shortening the project removes cuts beyond its duration. **Clear all project keyframes** and **Delete all** also remove cuts. Fixed camera cuts do not automatically track moving objects.
