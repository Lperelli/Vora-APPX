import type { BodyTypeId } from '@/lib/body-type-analysis'

export interface BodyTypeArticle {
  title: string
  summary: string
  url: string
  image: string
}

const BLOG_ORIGIN = 'https://vora-blog.webflow.io'

/**
 * Published Webflow CMS articles that close the loop from the app back into
 * VORA's editorial site. Pear is called Triangle in the journal.
 *
 * Apple is intentionally absent: no matching CMS article exists yet.
 */
export const BODY_TYPE_ARTICLES: Partial<Record<BodyTypeId, BodyTypeArticle>> = {
  hourglass: {
    title: 'Hourglass Body Shape | The Essentials for Your Closet',
    summary:
      'Discover the wardrobe essentials that highlight your naturally defined waist and maintain your shoulder-to-hip balance.',
    url: `${BLOG_ORIGIN}/post/hourglass-body-shape-the-essentials-for-your-closet`,
    image:
      'https://cdn.prod.website-files.com/69d083806c31fde4aa05b52f/6a66d0edca97e39b204efc40_RELOJ%20DE%20ARENA%201.webp',
  },
  rectangle: {
    title: 'Rectangle Body Shape | The Essentials for Your Closet',
    summary:
      'Discover wardrobe essentials that create definition, add dimension, and build effortlessly polished outfits.',
    url: `${BLOG_ORIGIN}/post/rectangle-body-shape-the-essentials-for-your-closet`,
    image:
      'https://cdn.prod.website-files.com/69d083806c31fde4aa05b52f/6a66d0facce6537c3b73c5d4_RECTANGULO%201.webp',
  },
  pear: {
    title: 'Triangle Body Shape | The Essentials for Your Closet',
    summary:
      'Learn how to highlight your waist, draw attention upward, and create clean, balanced outfits with flattering everyday pieces.',
    url: `${BLOG_ORIGIN}/post/triangle-body-shape-the-essentials-for-your-closet`,
    image:
      'https://cdn.prod.website-files.com/69d083806c31fde4aa05b52f/6a66d0d180acd9f6e6a870f5_TRIANGULO%201.webp',
  },
  'inverted-triangle': {
    title: 'Inverted Triangle Body Shape | The Essentials for Your Closet',
    summary:
      'Learn how to soften the shoulders, define the waist, and create balance with flattering everyday pieces.',
    url: `${BLOG_ORIGIN}/post/inverted-triangle-body-shape-the-essentials-for-your-closet`,
    image:
      'https://cdn.prod.website-files.com/69d083806c31fde4aa05b52f/6a66d0dfaaab25ed1852e52f_TRIANGULO%20INVERTIDO%201.webp',
  },
}
