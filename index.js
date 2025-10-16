import puppeteer from "puppeteer";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function for random delays (more human-like)
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Upvote function
async function clickUpvoteButton(page, postElement) {
  try {
    // Select upvote button using icon-name attribute
    let upvoteBtn = await postElement.$('>>> button:has(svg[icon-name="upvote-outline"])');
    
    if (upvoteBtn) {
      // Check if already upvoted
      const isUpvoted = await upvoteBtn.evaluate(btn => 
        btn.getAttribute('aria-pressed') === 'true'
      );
      
      if (!isUpvoted) {
        await upvoteBtn.click();
        console.log('👍 Post upvoted!');
        await sleep(2000); // Extra delay after upvote
        return true;
      } else {
        console.log('⚠️ Already upvoted');
        return false;
      }
    } else {
      console.log('❌ Upvote button not found');
      return false;
    }
  } catch (error) {
    console.error('Error clicking upvote:', error.message);
    return false;
  }
}

// Comment functions - SIMPLIFIED
async function clickCommentIconTwice(page, postElement) {
  try {
    // First click - Find comment button within the post element using SVG icon
    console.log('💬 Finding comment button for 1st click...');
    const commentBtn1 = await postElement.$('>>> svg[icon-name="comment-outline"]');
    
    if (commentBtn1) {
      console.log('💬 Clicking comment icon (1st time) to open comments...');
      await commentBtn1.click();
      
      // Delay after 1st click
      const firstClickDelay = randomDelay(5000, 7000);
      console.log(`⏳ Waiting ${firstClickDelay}ms for comments section to load...`);
      await sleep(firstClickDelay);
      
      // Second click - Search for the SVG icon again on the page
      console.log('💬 Finding comment icon for 2nd click...');
      const commentBtn2 = await page.$('>>> svg[icon-name="comment-outline"]');
      
      if (commentBtn2) {
        console.log('💬 Clicking comment icon (2nd time) to focus input...');
        await commentBtn2.click();
        
        // Delay after 2nd click
        const secondClickDelay = randomDelay(5000, 7000);
        console.log(`⏳ Waiting ${secondClickDelay}ms for input to be focused...`);
        await sleep(secondClickDelay);
        
        return true;
      } else {
        console.log('❌ Comment icon not found for 2nd click');
        return false;
      }
    } else {
      console.log('❌ Comment icon not found for 1st click');
      return false;
    }
  } catch (error) {
    console.error('Error clicking comment icon:', error.message);
    return false;
  }
}

async function typeCommentDirectly(page, commentText) {
  try {
    console.log('⌨️ Typing comment directly with keyboard...');
    
    // Type the comment with visible delay
    await page.keyboard.type(commentText, { delay: randomDelay(100, 200) });
    
    console.log('✅ Comment typed successfully!');
    
    // Delay after typing
    const typingDelay = randomDelay(3000, 5000);
    console.log(`⏳ Waiting ${typingDelay}ms so you can see the typed comment...`);
    await sleep(typingDelay);
    
    return true;
    
  } catch (error) {
    console.error('Error typing comment:', error.message);
    return false;
  }
}

async function submitCommentWithKeyboard(page) {
  try {
    console.log('⌨️ Submitting comment using Ctrl+Enter...');
    
    // Press Ctrl+Enter to submit
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
    
    // Delay after submission
    const submitDelay = randomDelay(5000, 7000);
    console.log(`⏳ Waiting ${submitDelay}ms for comment to be submitted and loaded...`);
    await sleep(submitDelay);
    
    console.log('✅ Comment submitted via Ctrl+Enter!');
    
    return true;
  } catch (error) {
    console.error('Error submitting comment with keyboard:', error.message);
    return false;
  }
}

async function postCommentOnPost(page, postElement, commentText) {
  try {
    console.log('\n--- Starting comment process ---');
    
    // Step 1: Click the comment icon twice
    const commentClicked = await clickCommentIconTwice(page, postElement);
    if (!commentClicked) return false;
    
    // Step 2: Type the comment
    const commentTyped = await typeCommentDirectly(page, commentText);
    if (!commentTyped) return false;
    
    // Step 3: Submit using Ctrl+Enter
    const commentSubmitted = await submitCommentWithKeyboard(page);
    
    return commentSubmitted;
  } catch (error) {
    console.error('❌ Error in posting comment:', error.message);
    return false;
  }
}

// Main function
async function loginScrollLikeAndComment() {
  // Check if credentials are loaded
  if (!process.env.REDDIT_USERNAME || !process.env.REDDIT_PASSWORD) {
    console.error('❌ Error: REDDIT_USERNAME and REDDIT_PASSWORD must be set in .env file');
    return;
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = (await browser.pages())[0];
  page.setDefaultNavigationTimeout(60000);

  // Go to Reddit login page
  await page.goto("https://www.reddit.com/login/", { waitUntil: "domcontentloaded" });

  // Login using environment variables
  await page.waitForSelector('>>> input[type="text"]', { timeout: 15000 });
  await page.type('>>> input[type="text"]', process.env.REDDIT_USERNAME, { delay: 100 });
  await page.type('>>> input[type="password"]', process.env.REDDIT_PASSWORD, { delay: 100 });

  await page.keyboard.press("Enter");
  
  try {
    await page.waitForNavigation({ waitUntil: "load", timeout: 60000 });
    console.log("✅ Login successful!");
  } catch (error) {
    console.log("⚠️ Navigation timeout, but continuing...");
  }

  // Go to homepage
  await page.goto("https://www.reddit.com/", { waitUntil: "load", timeout: 60000 });
  await sleep(3000);

  // Wait for posts
  await page.waitForSelector('>>> [slot="full-post-link"]', { timeout: 10000 });

  const postLinks = await page.$$('>>> [slot="full-post-link"]');

  if (postLinks.length === 0) {
    console.log("No posts found.");
    await browser.close();
    return;
  }

  console.log(`✅ Found ${postLinks.length} posts`);

  // Scroll through posts
  for (let i = 0; i < Math.min(5, postLinks.length); i++) {
    await postLinks[i].evaluate(el => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    console.log(`📜 Scrolled to post ${i + 1}`);
    
    const scrollDelay = randomDelay(4000, 6000);
    console.log(`⏳ Waiting ${scrollDelay}ms before next scroll...`);
    await sleep(scrollDelay);
  }

  console.log("⬇️ Scrolling done.\n");
  await sleep(2000);

  // Process posts - FIXED LOOP
  const numPostsToProcess = 3;
  
  for (let i = 0; i < numPostsToProcess; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing Post ${i + 1}/${numPostsToProcess}`);
    console.log(`${'='.repeat(60)}`);
    
    // Get fresh posts list each time
    const posts = await page.$$('shreddit-post');
    
    if (posts.length === 0) {
      console.log('⚠️ No posts found, skipping...');
      continue;
    }
    
    console.log(`📊 Found ${posts.length} posts on page`);
    
    // Use the first available post
    const currentPost = posts[0];
    
    // Scroll to the post
    try {
      await currentPost.evaluate(el => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      await sleep(2000);
    } catch (error) {
      console.log('⚠️ Could not scroll to post');
    }
    
    // Step 1: Upvote
    console.log(`\n🎯 Step 1: Upvoting post ${i + 1}...`);
    await clickUpvoteButton(page, currentPost);
    
    const actionDelay = randomDelay(4000, 6000);
    console.log(`⏳ Waiting ${actionDelay}ms before commenting...\n`);
    await sleep(actionDelay);
    
    // Step 2: Comment
    console.log(`💬 Step 2: Commenting on post ${i + 1}...`);
    const commentText = `Nice`;
    const commentSuccess = await postCommentOnPost(page, currentPost, commentText);
    
    if (commentSuccess) {
      console.log(`\n✅ Successfully processed post ${i + 1} (upvoted + commented)`);
      
      // Navigate back
      console.log('\n⬅️ Step 3: Navigating back to feed...');
      try {
        await page.goBack({ waitUntil: 'load', timeout: 60000 });
      } catch (error) {
        await page.goto("https://www.reddit.com/", { waitUntil: "load", timeout: 60000 });
      }
      
      const backDelay = randomDelay(4000, 6000);
      console.log(`⏳ Waiting ${backDelay}ms for page to stabilize...`);
      await sleep(backDelay);
    } else {
      console.log(`\n⚠️ Comment failed on post ${i + 1}, but upvote may have succeeded`);
      await page.goto("https://www.reddit.com/", { waitUntil: "load", timeout: 60000 });
      await sleep(3000);
    }
    
    if (i < numPostsToProcess - 1) {
      const nextPostDelay = randomDelay(6000, 10000);
      console.log(`\n⏳ Waiting ${nextPostDelay}ms before processing next post...\n`);
      await sleep(nextPostDelay);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log("✅ All posts processed (upvoted + commented)!");
  console.log(`${'='.repeat(60)}\n`);

  // Keep browser open
  // await browser.close();
}

loginScrollLikeAndComment();
