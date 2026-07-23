# Editing the site — operator guide

The site's words, images, artists, and section order all live in simple content
files. You edit them through a web panel — no code, no tools to install.

## Logging in

1. Go to `https://<the-site-domain>/admin/`
2. Click **Sign in with GitHub** and approve. (You need a GitHub account that
   has been added to the site repository — ask your developer to invite you.)

## Editing copy

Pick a page area in the left sidebar (Hero, Manifesto, Misfits Brigade,
Offerings, Misfits Acts, For Brands, Footer…), change the text, press **Save**.
The live site updates automatically about a minute after saving.

Some fields contain styling tags like `<span class="mark" …>word</span>` —
these draw the highlighter effect. **Edit the words, keep the tags.** If a
highlight ever breaks, just ask your developer to restore the previous version
(every save is kept in history and can be rolled back).

## Adding artists, offerings, acts, verticals

Anywhere you see a list (Brigade artists, Offering rows, Acts, vertical
slides), use **Add item** to append one, the drag handle to reorder, and the
item menu to delete. For an artist you set: photo, name, role, order number.

Images: click an image field → upload. Uploads land in the site's assets
folder. Please upload **.webp** images (or ask your developer to convert) and
keep them under ~300KB so the site stays fast.

## Reordering page sections

Open **Page structure**. The list shows the six movable sections in their
current order — drag to rearrange, save. The hero (top) and footer are fixed
and don't appear in the list. Don't delete entries or add duplicates; each
section should appear exactly once.

## If something looks wrong after a save

Nothing is ever lost — every save is a tracked revision. Tell your developer
what changed and they can roll the site back to any earlier state in one step.
