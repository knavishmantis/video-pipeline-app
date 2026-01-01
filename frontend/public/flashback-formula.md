# KnavishMantis Shorts Flashbacker Formula

⚠️ Do not share this guide with anyone without explicit permission from me (KnavishMantis), this is proprietary information meant only for contributors to the KnavishMantis youtube channel.

The flashbacker will be given a PDF of the script which will include dialogue of the narration and also a general scene guide as a reference.
Below is a portion of an example script (which will include notes to both the flashbacker and the editor): 

**<img width="741" height="526" alt="image" src="/flashback-images/4ef1d256-bb14-4cd7-94ed-6a3a7e73a454.png" />**

For example for #3, you as the flashbacker will go to a desert, record yourself running into a cactus using flashback, then export the recording as 3.mp4 according to the process in detail below. The script may require related clips for a particular entry in which case there might be 3a.mp4, 3b.mp4, etc.

Then, the flashbacker will deliver a folder containing all of the clips needed for that video:

<img width="176" height="280" alt="image" src="/flashback-images/d3d251df-0b1b-4ff6-91e3-cd051c59bac3.png" />

## Mods and MC Version Setup

### Minecraft Version and Mods Setup
- Use Minecraft Fabric 1.21.8 with fabric loader version 0.17.2
- Directly download the mods folder here: add these jars to your .minecraft/mods after installing fabric 1.21.8: https://drive.google.com/drive/folders/1-0eJpLVQDNwgE8pGVOyI39m_ZMdRWubG?usp=sharing
- Download the Complementary Reimagined ShaderPack here: https://modrinth.com/shader/complementary-reimagined/version/latest

### Complementary Reimagined Shaderpack Settings

Download the below .txt file which contains the settings and click this Import Settings from File button under Complementary Reimagined Shader Settings and select the file:
<img width="1716" height="257" alt="image" src="/flashback-images/6fa9e962-017a-4746-8aa9-56d6bde61972.png" />

[ComplementaryReimagined_r5.5.1.txt](https://github.com/user-attachments/files/24384415/ComplementaryReimagined_r5.5.1.txt)

### Distant Horizons (DH) Setup

Distant Horizons (DH) is a mod which gives the appearance of having infinite render distance. Ensure its enabled with these settings:
<img width="2170" height="939" alt="image" src="/flashback-images/c2ee61ea-221d-47cd-beb3-be27dcc35b01.png" />

With DH enabled, ensure that your vanilla render distance is set to 8:
<img width="991" height="304" alt="image" src="/flashback-images/23d3ca53-b892-4b6d-b879-679554d271db.png" />

### Set FOV to 90

Set vanilla FOV to 90, certain scenes may call for changing the FOV in flashback but as a default use 90

<img width="1399" height="192" alt="image" src="/flashback-images/1bc119ce-f0ff-44be-bb3a-0e28e0e8bc63.png" />

## Skin, Nametag / Brand Continuity Setup

For developing brand continuity, when recording ingame clips (not using flashback) like trading with a villager, opening a chest, or in f5 mode, have your minecraft account's skin set to this skin: https://namemc.com/skin/160a2885d128a665.

In flashback, when exporting clips, set the nametag to KnavishMantis and the skin to the same as the one above using this menu: <img width="1225" height="1378" alt="image" src="/flashback-images/e0b4e57d-ba56-4ba2-af41-a37789c73e6f.png" />

## Using Flashback

### Rule of Thirds Guide

When recording flashback shorts clips on a PC screen, select the "Rule of Thirds Guide" option on the right side of flashback, any content which is in the middle third will fit into the screen when edited into a short. When keyframing, make sure the main content stays within the middle third.

<img width="3741" height="1985" alt="tmp" src="/flashback-images/2c847dbf-f457-47dd-b792-38cc848559e8.png" />

### Export Settings

When exporting from flashback, ensure the resolution is set to 3840 by 2160, and ensure that Record Audio is Selected:

<img width="390" height="481" alt="image" src="/flashback-images/c8d69546-9c2c-4023-9b93-70794f3b381a.png" />

### Making the Clip Longer, Its better to have the clip too long rather than too short

When setting the start point of the clip, try to have the clip start where the editor would want to begin the clip as well to help avoid confusion as to what the highlight of the clip is. And, if you predict that for the specific line of dialogue, the clip should be about 4 seconds, make it a few seconds longer than you think like 7 seconds for example incase the syncing is not what you expected. Long clips can be cut but short clips can't really be extended in editing.

### Always Have Constant Motion

When exporting from flashback, never have a static camera, meaning the camera should always be at least slightly moving and should feel smooth. Common animations I use are subtle left to right movement of the camera, top to bottom, and bottom to top movement. Try to avoid right to left movement of the camera unless a certain clip calls for it.

### Turn off daylight cycle

Use /gamerule doDaylightCycle false to prevent the time of day from changing. This will keep the continuity instead of having clips that are right next to each other being very different times in game, it would feel weird and unexpected in the final video.

### Set the ingame time

A good default value would be /time set 3000, or /time set 7000. Avoid using /time set noon because the shadows look worse.

### World Edit Commands and Command Blocks

Certain clips may call for using world edit commands or command blocks within the flashback animation. For example, in the below clip, I selected the wall in world edit and use //set cobblestone, //set redstone_block on a cadence while flashback recording so that when the flashabck video was exported it looked like they were naturally changing. About 9 seconds to 13 seconds in this short: https://www.youtube.com/shorts/vi0e1Jm_gvs

ChatGPT is usually a good reference for how to do things using world edit / command blocks

### Timelapse

Timelapses are often used, they require building something such as blocks spelling a word or a number like "Subscribe" or a build like a wall around a village. In this case, you just build them like normal while flashback recording and set the exported timelapse to generally fit the time that the dialogue would take up in the final video, always leaning on the longer side because a long video can be sped up but a short video usually can't be stretched.

### Usage of a "Studio World"

A studio world is a superflat world with a particular floor to give the effect that the player is in a studio. Below is an example of a Studio World:

<img width="578" height="832" alt="image" src="/flashback-images/380ef84e-d085-4f45-9b67-6a2dea86823d.png" />

To create a studio world, start creating a superflat world like normal. Then, push this Customize button next to World Type: Superflat:

<img width="1329" height="363" alt="image" src="/flashback-images/954d28f9-ff11-481f-ade7-084782356a9a.png" />

Then, push Presets at the bottom and you should see this screen:

<img width="2630" height="2047" alt="image" src="/flashback-images/2864c784-3dd7-4187-8cf1-017358d5d4c1.png" />

Now, we'll use a mod I created to add these custom blocks, at the top text box, delete "minecraft:grass_block" and replace it with "off-white-blocks:mint_block" and it should look like this:

<img width="1837" height="248" alt="image" src="/flashback-images/94d85690-d17b-46e8-8913-35313b6f293a.png" />

This off-white-blocks is a mod I created to add various neutral blocks textures, you can use different ones in off-white-blocks if you prefer those, you can see all of them by typing /give @s off-white-blocks ingame.

Then click Use Preset and you should see the mint block previewed:

<img width="1078" height="502" alt="image" src="/flashback-images/1a215efa-f8e9-47a7-bdbf-2e4ed60fc777.png" />

Finally, push done, turn generate structures to off, and create the world. You'll want to run /gamemode doMobSpawning false once in the game to prevent a ton of slimes from spawning in.

## Other and General

### Using OBS for ingame recording

For certain clips like recording the ingame inventory, recording the character in third person (f5 mode), or trading with a villager for example, you can use OBS or a similar recording software. Ensure that you are exporting in 4K if possible. If the framerate of the clip goes below 60 due to lag, make sure you rerecord that section until its a smooth framerate. You can often use an FPS indicator in the top left of the minecraft client since the shorts screen will usually only take the middle third.
