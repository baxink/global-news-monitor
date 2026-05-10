DELETE FROM media_sources;
INSERT INTO media_sources (
  id,
  country,
  country_code,
  media_name,
  language,
  homepage_url,
  feed_url,
  section,
  parser_type,
  article_limit,
  enabled,
  priority
) VALUES
  ('nature-main-rss', '英国', 'GB', 'Nature', 'en', 'https://www.nature.com', 'https://www.nature.com/nature.rss', 'main', 'rss', 24, 1, 1),
  ('nature-news', '英国', 'GB', 'Nature', 'en', 'https://www.nature.com/news', 'https://www.nature.com/news', 'news', 'html', 18, 1, 2),
  ('nature-opinion', '英国', 'GB', 'Nature', 'en', 'https://www.nature.com/opinion', 'https://www.nature.com/opinion', 'opinion', 'html', 18, 1, 3),
  ('nature-research-analysis', '英国', 'GB', 'Nature', 'en', 'https://www.nature.com/research-analysis', 'https://www.nature.com/research-analysis', 'research-analysis', 'html', 18, 1, 4),
  ('nature-research-articles', '英国', 'GB', 'Nature', 'en', 'https://www.nature.com/nature/research-articles', 'https://www.nature.com/nature/research-articles', 'research-articles', 'html', 18, 1, 5),
  ('nature-careers', '英国', 'GB', 'Nature Careers', 'en', 'https://www.nature.com/careers', 'https://www.nature.com/careers', 'careers', 'html', 18, 1, 6);
