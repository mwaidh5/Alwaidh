import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ar';

const LS_KEY = 'alwaidh.lang.v1';

/**
 * Arabic strings, keyed by the English source text. Anything missing falls
 * back to English, so wrapping a string is always safe and the site never
 * shows a blank or a raw key.
 */
const AR: Record<string, string> = {
  // ---- Navigation & shell ----
  Home: 'الرئيسية',
  Shop: 'المتجر',
  'Solar Prices': 'أسعار الطاقة الشمسية',
  Cart: 'السلة',
  About: 'من نحن',
  'Contact us': 'اتصل بنا',
  'Sign in': 'تسجيل الدخول',
  'Sign out': 'تسجيل الخروج',
  'Sign up': 'إنشاء حساب',
  'My account': 'حسابي',
  Dashboard: 'لوحة التحكم',
  Search: 'بحث',
  'Search products…': 'ابحث عن منتج…',
  Menu: 'القائمة',
  Browse: 'تصفح',
  Support: 'الدعم',
  Company: 'الشركة',
  Privacy: 'الخصوصية',
  Terms: 'الشروط',
  Warranty: 'الضمان',
  'Shipping & Returns': 'الشحن والإرجاع',
  'All rights reserved.': 'جميع الحقوق محفوظة.',
  'Computers, solar energy solutions, and Tiandy security cameras — all in one shop.':
    'حواسيب وأنظمة طاقة شمسية وكاميرات مراقبة تياندي — في متجر واحد.',

  // ---- Home ----
  'Your Tech Destination': 'وجهتك التقنية',
  'Power Your': 'شغّل',
  WORK: 'عملك',
  'Secure Your': 'واحمِ',
  WORLD: 'عالمك',
  'Complete systems': 'أنظمة متكاملة',
  'Where Power Meets Reliability': 'حيث تلتقي الطاقة بالموثوقية',
  'Computers, solar energy, and security cameras — supplied, installed, and serviced by our own team.':
    'حاسبات وأنظمة طاقة شمسية وكاميرات مراقبة — توريد وتركيب وصيانة من فريقنا.',
  'Explore Now': 'تصفّح الآن',
  'Trusted across Iraq': 'موثوقون في عموم العراق',
  'since 1992': 'منذ 1992',
  Featured: 'منتج مميز',
  'Shop by Category': 'تسوّق حسب الفئة',
  'Shop Now →': 'تسوّق الآن →',
  'View all →': 'عرض الكل →',
  'New Season': 'موسم جديد',
  Collection: 'تشكيلة',
  Computers: 'الحواسيب',
  'Solar Energy': 'الطاقة الشمسية',
  'Tiandy Cameras': 'كاميرات تياندي',
  'Security Cameras': 'كاميرات المراقبة',
  Cameras: 'المراقبة',
  'Camera range coming online soon': 'تشكيلة الكاميرات ستتوفر قريباً',
  'We supply and install the full Tiandy line-up — IP cameras, NVRs, and complete CCTV systems. Ask us for a quote in the meantime.':
    'نوفّر ونركّب تشكيلة تياندي الكاملة — كاميرات IP وأجهزة تسجيل وأنظمة مراقبة متكاملة. تواصل معنا للحصول على عرض سعر.',
  'Professional IP cameras and NVRs from an authorised Tiandy reseller — built for homes, shops, and business sites.':
    'كاميرات IP وأجهزة تسجيل احترافية من وكيل معتمد لتياندي — للمنازل والمحلات والمواقع التجارية.',
  'Shop Tiandy Cameras': 'تسوّق كاميرات تياندي',
  'Power tomorrow today': 'شغّل الغد من اليوم',
  'with solar': 'بالطاقة الشمسية',
  'Panels, inverters, and batteries sized for your home or business — supplied and installed by the team that knows the gear.':
    'ألواح وعاكسات وبطاريات مصممة لمنزلك أو عملك — توريد وتركيب من فريق يعرف المعدات.',
  'View Solar Prices': 'عرض أسعار الطاقة الشمسية',
  'Complete solar systems': 'أنظمة شمسية متكاملة',
  'Panels, inverters, and batteries supplied as one working system — sized for your actual load.':
    'ألواح وعاكسات وبطاريات كنظام واحد متكامل — مصمم حسب استهلاكك الفعلي.',
  'Discover our systems →': 'اكتشف أنظمتنا →',
  'SolarMax batteries': 'بطاريات SolarMax',
  'More power, more backup — tubular and lithium batteries built for long, hot days and nightly runtime.':
    'طاقة أكبر واحتياطي أطول — بطاريات تيوبلر وليثيوم مصنوعة للأيام الحارة والتشغيل الليلي.',
  'Shop batteries →': 'تسوّق البطاريات →',
  'Brands we work with': 'العلامات التجارية التي نتعامل معها',
  'Expert support': 'دعم متخصص',
  Security: 'أنظمة',
  'Fast delivery': 'توصيل سريع',
  'Same-day dispatch on in-stock items across Baghdad and beyond.':
    'شحن في نفس اليوم للمنتجات المتوفرة في بغداد وبقية المحافظات.',
  'Genuine products': 'منتجات أصلية',
  'Solar experts': 'خبراء الطاقة الشمسية',
  'Security cameras & NVRs': 'كاميرات وأجهزة تسجيل',
  'All Products': 'كل المنتجات',
  'View All Products': 'عرض كل المنتجات',
  'Fresh in store': 'وصل حديثاً',
  'Latest Collection': 'أحدث التشكيلات',
  'Real help sizing solar systems, PCs, and CCTV — before and after you buy.':
    'مساعدة حقيقية في اختيار أنظمة الطاقة والحواسيب والمراقبة — قبل الشراء وبعده.',

  // ---- Homepage ----
  'New arrivals': 'وصل حديثاً',
  'Clean energy': 'طاقة نظيفة',
  Surveillance: 'المراقبة والحماية',
  'Laptops built for': 'حواسيب محمولة مصنوعة',
  'real work': 'للعمل الحقيقي',
  'Cut your power bill': 'خفّض فاتورة الكهرباء',
  'for good': 'إلى الأبد',
  'Tiandy cameras,': 'كاميرات تياندي،',
  'properly installed': 'بتركيب احترافي',
  "Business machines, workstations and accessories — spec’d properly, warrantied locally, and in stock today.":
    'أجهزة للأعمال ومحطات عمل وملحقات — بمواصفات مدروسة وكفالة محلية ومتوفرة اليوم.',
  'Panels, inverters and batteries sized for your home or shop. Free site survey, installed by our own crew.':
    'ألواح وإنفرترات وبطاريات بمقاسات تناسب بيتك أو محلك. كشف موقعي مجاني وتركيب بفريقنا.',
  'IP cameras, NVRs and full-site coverage from an authorised Tiandy reseller.':
    'كاميرات IP وأجهزة تسجيل وتغطية كاملة للموقع من موزّع تياندي المعتمد.',
  'Shop computers': 'تسوّق الحواسيب',
  'Talk to us': 'تحدث إلينا',
  'Get a free solar quote': 'احصل على عرض سعر مجاني',
  'See the price sheet': 'اطّلع على قائمة الأسعار',
  'Shop cameras': 'تسوّق الكاميرات',
  'Book an install': 'احجز موعد تركيب',
  'Shop by category': 'تسوّق حسب الفئة',
  'View all products': 'عرض كل المنتجات',
  products: 'منتج',
  'Explore now': 'اكتشف الآن',
  'In stock now': 'متوفر الآن',
  'From the shop': 'من المتجر',
  'More to explore': 'المزيد لاكتشافه',
  'Browse everything': 'تصفّح كل شيء',
  'Same-day dispatch in Baghdad, and across Iraq within days.':
    'شحن في نفس اليوم داخل بغداد، وخلال أيام إلى بقية المحافظات.',
  'Cash on delivery': 'الدفع عند الاستلام',
  'Pay when the order reaches your door — nothing upfront.':
    'ادفع عند وصول الطلب إلى بابك — بدون أي مبلغ مقدماً.',
  'Easy replacement': 'استبدال سهل',
  'Wrong item or changed your mind? Swap or return it.':
    'وصلك منتج خاطئ أو غيّرت رأيك؟ بدّله أو أرجعه.',
  'Everything we sell comes from the authorised source.':
    'كل ما نبيعه يأتي من المصدر المعتمد.',
  'Shop all': 'تسوّق الكل',
  Partners: 'شركاؤنا',
  'Brands we carry': 'الماركات التي نوفّرها',
  '12-month warranty': 'كفالة ١٢ شهراً',
  'On every computer and camera we sell.': 'على كل حاسوب وكاميرا نبيعها.',
  'Same-day dispatch on in-stock items in Baghdad.':
    'شحن في نفس اليوم للمنتجات المتوفرة داخل بغداد.',
  'Installed by our crew': 'تركيب بفريقنا',
  'Solar and CCTV, never subcontracted.': 'الطاقة الشمسية والمراقبة، بدون مقاولين من الباطن.',
  'Repairs in-house': 'صيانة داخلية',
  'Diagnostics within 48 hours.': 'فحص وتشخيص خلال ٤٨ ساعة.',
  Previous: 'السابق',
  Next: 'التالي',
  Slide: 'شريحة',

  // ---- Solar quote form ----
  'Free site survey': 'كشف موقعي مجاني',
  'Tell us your bill —': 'أخبرنا بفاتورتك —',
  'we’ll size the system': 'ونحدد لك حجم المنظومة',
  'Most homes we fit run their essentials through the night and pay back the system in under three years.':
    'معظم البيوت التي نجهّزها تشغّل أساسياتها طوال الليل وتسترد كلفة المنظومة خلال أقل من ثلاث سنوات.',
  'Free survey and load assessment': 'كشف مجاني وحساب الأحمال',
  'Panels, inverter, batteries and install in one quote':
    'الألواح والإنفرتر والبطاريات والتركيب في عرض واحد',
  'Two-year workmanship warranty': 'كفالة سنتين على التركيب',
  'Request a solar quote': 'اطلب عرض سعر للطاقة الشمسية',
  'Full name': 'الاسم الكامل',
  'Your name': 'اسمك',
  'Phone number': 'رقم الهاتف',
  City: 'المدينة',
  'Select your city': 'اختر مدينتك',
  Baghdad: 'بغداد',
  Basra: 'البصرة',
  Erbil: 'أربيل',
  Mosul: 'الموصل',
  Najaf: 'النجف',
  'Average monthly bill': 'معدل الفاتورة الشهرية',
  'Select a range': 'اختر النطاق',
  'Under 50,000 IQD': 'أقل من ٥٠٬٠٠٠ د.ع',
  '50,000 – 150,000 IQD': '٥٠٬٠٠٠ – ١٥٠٬٠٠٠ د.ع',
  'Over 150,000 IQD': 'أكثر من ١٥٠٬٠٠٠ د.ع',
  'Request a free site visit': 'اطلب زيارة موقعية مجانية',
  'Sending…': 'جاري الإرسال…',
  'We’ll call you within 24 hours. No obligation.': 'سنتصل بك خلال ٢٤ ساعة. بدون أي التزام.',
  'Thanks — we’ll call you within 24 hours.': 'شكراً — سنتصل بك خلال ٢٤ ساعة.',
  'Please add your name and phone number.': 'الرجاء إضافة اسمك ورقم هاتفك.',

  // ---- Product & shop ----
  'Add to cart': 'أضف إلى السلة',
  'Added ✓': 'تمت الإضافة ✓',
  'In stock': 'متوفر',
  'Out of stock': 'غير متوفر',
  Out: 'نفد',
  Specifications: 'المواصفات',
  Datasheet: 'ورقة البيانات',
  'Open in new tab ↗': 'فتح في تبويب جديد ↗',
  'Download manual (PDF)': 'تحميل الدليل (PDF)',
  'You may also like': 'قد يعجبك أيضاً',
  'Loading datasheet…': 'جاري تحميل ورقة البيانات…',
  'Product not found': 'المنتج غير موجود',
  'Back to home': 'العودة للرئيسية',
  'Loading product…': 'جاري تحميل المنتج…',
  'All categories': 'كل الفئات',
  'No products match.': 'لا توجد منتجات مطابقة.',
  Price: 'السعر',
  Category: 'الفئة',
  Brand: 'الماركة',
  Product: 'المنتج',
  Products: 'المنتجات',
  Filters: 'عوامل التصفية',
  'Sort by': 'ترتيب حسب',
  Newest: 'الأحدث',
  'Price: low to high': 'السعر: من الأقل للأعلى',
  'Price: high to low': 'السعر: من الأعلى للأقل',

  // ---- Cart & checkout ----
  'Your cart': 'سلتك',
  'Your cart is empty.': 'سلتك فارغة.',
  'Continue shopping': 'مواصلة التسوق',
  Subtotal: 'المجموع الفرعي',
  Shipping: 'الشحن',
  Tax: 'الضريبة',
  Total: 'الإجمالي',
  Checkout: 'إتمام الشراء',
  Remove: 'إزالة',
  Quantity: 'الكمية',
  Qty: 'الكمية',

  // ---- Auth ----
  Email: 'البريد الإلكتروني',
  Password: 'كلمة المرور',
  'Continue with Google': 'المتابعة عبر جوجل',
  'Forgot password?': 'نسيت كلمة المرور؟',
  'Create an account': 'إنشاء حساب',
  'Send verification email': 'إرسال بريد التحقق',
  'Not authorised': 'غير مصرّح',

  // ---- Admin shell ----
  Overview: 'نظرة عامة',
  'Solar Jobs': 'أعمال الطاقة الشمسية',
  Media: 'الوسائط',
  Orders: 'الطلبات',
  Users: 'المستخدمون',
  Submissions: 'الرسائل',
  Analytics: 'التحليلات',
  Settings: 'الإعدادات',
  Admin: 'الإدارة',
  'Signed in as': 'مسجّل الدخول باسم',
  Loading: 'جاري التحميل',
  'Loading…': 'جاري التحميل…',
  Save: 'حفظ',
  'Saving…': 'جاري الحفظ…',
  Cancel: 'إلغاء',
  Delete: 'حذف',
  Edit: 'تعديل',
  Close: 'إغلاق',
  Refresh: 'تحديث',
  Restore: 'استعادة',
  'Copy link': 'نسخ الرابط',
  'Copied!': 'تم النسخ!',
  Selected: 'محدد',
  Clear: 'مسح',
  Preview: 'معاينة',
  Upload: 'رفع',
  'Upload image': 'رفع صورة',
  'Upload images': 'رفع صور',
  'Uploading…': 'جاري الرفع…',
  '🖼️ Choose from website': '🖼️ اختر من الموقع',
  'Choose from website': 'اختر من الموقع',
  'Use image': 'استخدام الصورة',
  'Tap an image to select': 'اضغط على صورة لاختيارها',
  'Tap images to select': 'اضغط على الصور لاختيارها',
  'Search by name or folder…': 'ابحث بالاسم أو المجلد…',
  'No images on the site yet.': 'لا توجد صور على الموقع بعد.',
  'Loading images…': 'جاري تحميل الصور…',

  // ---- Admin: products ----
  'Add product': 'إضافة منتج',
  '+ Add product': '+ إضافة منتج',
  'New product': 'منتج جديد',
  'Edit product': 'تعديل المنتج',
  'Save changes': 'حفظ التغييرات',
  Create: 'إنشاء',
  Name: 'الاسم',
  Currency: 'العملة',
  'Rating (0–5)': 'التقييم (0–5)',
  'Available for purchase': 'متاح للشراء',
  'Product images': 'صور المنتج',
  'Short description': 'وصف مختصر',
  'Specs (one per line, key: value)': 'المواصفات (سطر لكل مواصفة، المفتاح: القيمة)',
  'Remove background (main)': 'إزالة الخلفية (الرئيسية)',
  'Removing…': 'جاري الإزالة…',
  'Edit image': 'تعديل الصورة',
  'Rotate left': 'تدوير لليسار',
  'Rotate right': 'تدوير لليمين',
  'Apply crop': 'تطبيق القص',
  'Reset crop': 'إلغاء القص',
  'Remove background': 'إزالة الخلفية',
  'Save image': 'حفظ الصورة',
  'Drag the corners to crop. The rest is dimmed and will be cut away.':
    'اسحب الزوايا للقص. الجزء المعتم سيُقتطع.',
  'Could not open the image.': 'تعذر فتح الصورة.',
  'Choose the photo from this device': 'اختر الصورة من هذا الجهاز',
  'Could not download this image — it may come from another website, or a firewall or antivirus is blocking it. Pick the photo from this device instead.':
    'تعذر تنزيل هذه الصورة — قد تكون من موقع آخر، أو أن جدار حماية أو مضاد فيروسات يمنع تنزيلها. اختر الصورة من هذا الجهاز بدلاً من ذلك.',
  'Background removal could not load its AI model. Check your internet connection and try again.':
    'تعذر تحميل نموذج الذكاء الاصطناعي لإزالة الخلفية. تحقق من اتصال الإنترنت وحاول مجدداً.',
  'This device ran out of memory running the AI. Try on a computer instead.':
    'نفدت ذاكرة هذا الجهاز أثناء تشغيل الذكاء الاصطناعي. جرّب على حاسوب.',
  Main: 'رئيسية',
  Trash: 'المحذوفات',
  'The Trash is empty.': 'سلة المحذوفات فارغة.',
  'Delete forever': 'حذف نهائي',
  '↩️ Restore': '↩️ استعادة',
  'Search by name, brand, or id': 'ابحث بالاسم أو الماركة أو المعرّف',
  'In use': 'قيد الاستخدام',
  Unused: 'غير مستخدم',
  'Not used anywhere': 'غير مستخدم في أي مكان',
  'Media library': 'مكتبة الوسائط',
  Draft: 'مسودة',
  Activity: 'السجل والتعليقات',
  'created this job': 'أنشأ هذا العمل',
  'Job created': 'تم إنشاء العمل',
  'Job details updated': 'تم تعديل تفاصيل العمل',
  'Write a comment… use @ to tag someone': 'اكتب تعليقاً… استخدم @ للإشارة إلى شخص',
  'Post comment': 'إرسال التعليق',
  'Posting…': 'جاري الإرسال…',
  'Sub-category': 'الفئة الفرعية',
  'Sub-categories': 'الفئات الفرعية',
  'Product sub-categories': 'الفئات الفرعية للمنتجات',
  '— none —': '— بدون —',
  'One per line': 'واحد في كل سطر',
  'Add sub-categories in Settings → Product sub-categories.':
    'أضف الفئات الفرعية من الإعدادات ← الفئات الفرعية للمنتجات.',
  'New since you last looked': 'جديد منذ آخر زيارة',
  'Turn on notifications': 'تفعيل الإشعارات',
  'Notifications on': 'الإشعارات مفعّلة',
  'Notifications blocked — enable them in phone settings':
    'الإشعارات محظورة — فعّلها من إعدادات الهاتف',
  'Make draft': 'تحويل إلى مسودة',
  Delivery: 'التوصيل',
  'Default delivery fee': 'أجرة التوصيل الافتراضية',
  'Delivery fee (blank = store default)': 'أجرة التوصيل (اتركها فارغة لاستخدام الافتراضية)',
  'Uses the default delivery fee': 'تُستخدم أجرة التوصيل الافتراضية',
  'Needs its own delivery': 'يحتاج توصيل منفصل',
  'its fee is added on top, even when the cart holds other items':
    'تُضاف أجرته فوق الأجرة الأخرى حتى لو كانت السلة تحتوي منتجات ثانية',
  'Ships separately': 'يُشحن بشكل منفصل',
  'Please enter your name, email, and phone number.':
    'يرجى إدخال الاسم والبريد الإلكتروني ورقم الهاتف.',
  'Shipping address': 'عنوان التوصيل',
  Drafts: 'المسودات',
  Live: 'منشور',
  Publish: 'نشر',
  'Save as draft': 'حفظ كمسودة',
  'Keep as draft': 'الإبقاء كمسودة',
  'Only staff can see drafts — customers never do.':
    'المسودات تظهر للموظفين فقط ولا يراها الزبائن.',
  'This product is a draft — it is hidden from the shop until you publish it.':
    'هذا المنتج مسودة — لن يظهر في المتجر حتى تقوم بنشره.',

  // ---- Admin: jobs ----
  'New job': 'عمل جديد',
  '+ New job': '+ عمل جديد',
  'Edit job': 'تعديل العمل',
  'Job details': 'تفاصيل العمل',
  Details: 'التفاصيل',
  'View all details': 'عرض كل التفاصيل',
  'Track installs and repairs. Drag a card between columns to update its status.':
    'تابع التركيبات والصيانة. اسحب البطاقة بين الأعمدة لتغيير الحالة.',
  'The installations assigned to you.': 'الأعمال المسندة إليك.',
  'Deleted jobs': 'الأعمال المحذوفة',
  'The trash is empty.': 'سلة المحذوفات فارغة.',
  Deleted: 'حُذف',
  by: 'بواسطة',
  'No details': 'بدون تفاصيل',
  'Delete forever?': 'حذف نهائي؟',
  'This cannot be undone.': 'لا يمكن التراجع عن هذا.',
  'Drop photos or PDFs here': 'أفلت الصور أو ملفات PDF هنا',
  Attach: 'إرفاق',
  'Previous photo': 'الصورة السابقة',
  'Next photo': 'الصورة التالية',

  // ---- Live chat ----
  'Chat with us': 'تحدث معنا',
  'We reply as soon as we can.': 'نرد في أقرب وقت ممكن.',
  'Ask us anything about products, prices, or an order — we read every message.':
    'اسألنا عن المنتجات أو الأسعار أو طلبك — نقرأ كل رسالة.',
  'Type a message…': 'اكتب رسالة…',
  'Your name (optional)': 'اسمك (اختياري)',
  Send: 'إرسال',
  'Could not send — check your connection and try again.':
    'تعذر الإرسال — تحقق من الاتصال وحاول مجدداً.',
  Messages: 'الرسائل',
  'New chat message': 'رسالة دردشة جديدة',
  'New team message': 'رسالة جديدة من الفريق',
  'New solar job': 'عمل طاقة شمسية جديد',
  'New order': 'طلب جديد',
  'New enquiry': 'استفسار جديد',
  'Open the dashboard to take a look.': 'افتح لوحة التحكم للاطلاع.',

  // ---- Notification settings ----
  Notifications: 'الإشعارات',
  'Notifications blocked': 'الإشعارات محظورة',
  'Turning on…': 'جاري التفعيل…',
  'Notifications are on for this device.': 'الإشعارات مفعّلة على هذا الجهاز.',
  'Get a notification on this device when something needs you.':
    'احصل على إشعار على هذا الجهاز عندما يستجد شيء يخصك.',
  'This version of the app was built before notifications existed. Install the newest build from TestFlight (or Play Store), then open this panel again.':
    'هذه النسخة من التطبيق أُنشئت قبل إضافة الإشعارات. ثبّت أحدث إصدار من TestFlight (أو متجر Play) ثم افتح هذه النافذة مجدداً.',
  'iPhone browsers only allow notifications for apps added to the Home Screen. Use the Alwaidh app, or tap Share → Add to Home Screen and open it from there.':
    'متصفحات الآيفون تسمح بالإشعارات فقط للتطبيقات المضافة إلى الشاشة الرئيسية. استخدم تطبيق الوايذ، أو اضغط مشاركة ← إضافة إلى الشاشة الرئيسية وافتحه من هناك.',
  'This browser cannot show notifications. Try Chrome, or use the phone app.':
    'هذا المتصفح لا يدعم الإشعارات. جرّب Chrome أو استخدم تطبيق الهاتف.',
  'Notifications are blocked. Allow them for Alwaidh in your phone or browser settings, then come back.':
    'الإشعارات محظورة. اسمح بها لتطبيق الوايذ من إعدادات الهاتف أو المتصفح ثم عد إلى هنا.',
  'Tell me about': 'أبلغني عن',
  'New solar jobs': 'أعمال شمسية جديدة',
  'When a job is added to the board.': 'عند إضافة عمل جديد إلى اللوحة.',
  'Job comments & changes': 'تعليقات وتعديلات الأعمال',
  'Comments, edits, and moves between columns.': 'التعليقات والتعديلات والنقل بين الأعمدة.',
  'New orders and status changes.': 'الطلبات الجديدة وتغيّر حالتها.',
  'Customer messages': 'رسائل الزبائن',
  'Website chat and contact-form enquiries.': 'دردشة الموقع واستفسارات نموذج التواصل.',
  'Messages from colleagues, and @ tags.': 'رسائل الزملاء والإشارات بـ @.',
  'These settings apply to this phone only.': 'هذه الإعدادات تخص هذا الهاتف فقط.',
  'In a browser, notifications arrive while a dashboard tab is open.':
    'في المتصفح، تصل الإشعارات ما دامت لوحة التحكم مفتوحة في تبويب.',
  Done: 'تم',
  'A visitor wrote in the website chat. Tap to reply.':
    'كتب زائر في دردشة الموقع. اضغط للرد.',
  'Conversations from the chat bubble on the website appear here.':
    'محادثات فقاعة الدردشة في الموقع تظهر هنا.',
  conversations: 'محادثة',
  unread: 'غير مقروءة',
  'No conversations yet.': 'لا توجد محادثات بعد.',
  'Pick a conversation to read and reply.': 'اختر محادثة للقراءة والرد.',
  'Write a reply…': 'اكتب رداً…',
  'Send a product': 'إرسال منتج',

  // ---- Team chat ----
  'Team chat': 'دردشة الفريق',
  'Message colleagues, start a group, and point at a job or a product.':
    'راسل زملاءك، أنشئ مجموعة، وأشر إلى عمل أو منتج.',
  '+ New chat': '+ محادثة جديدة',
  'New chat': 'محادثة جديدة',
  'No conversations yet. Start one with “+ New chat”.':
    'لا توجد محادثات بعد. ابدأ واحدة عبر «+ محادثة جديدة».',
  'Pick a conversation, or start a new one.': 'اختر محادثة أو ابدأ واحدة جديدة.',
  'No messages yet': 'لا توجد رسائل بعد',
  'Message… use @ to tag someone': 'رسالة… استخدم @ للإشارة إلى شخص',
  'Send a job': 'إرسال عمل',
  'Open in Solar Jobs': 'فتح في أعمال الطاقة الشمسية',
  'No jobs found.': 'لا توجد أعمال مطابقة.',
  'Group name (optional)': 'اسم المجموعة (اختياري)',
  'Create group': 'إنشاء مجموعة',
  'Start chat': 'بدء المحادثة',
  'No colleagues yet — add staff under Users.': 'لا يوجد زملاء بعد — أضف موظفين من صفحة المستخدمين.',
  people: 'أشخاص',
  'View product': 'عرض المنتج',
  'No products found.': 'لا توجد منتجات مطابقة.',
  'Search by name, brand, or category': 'ابحث بالاسم أو الماركة أو الفئة',
  You: 'أنت',
  'Delete conversation': 'حذف المحادثة',
  'New Requests': 'طلبات جديدة',
  Scheduled: 'مجدول',
  'In Progress': 'قيد التنفيذ',
  Completed: 'مكتمل',
  'Cancelled / Delayed': 'ملغى / مؤجل',
  'Customer name': 'اسم الزبون',
  Phone: 'الهاتف',
  Address: 'العنوان',
  'Job type': 'نوع العمل',
  Install: 'تركيب',
  Repair: 'صيانة',
  'System / details': 'النظام / التفاصيل',
  Installer: 'الفني',
  'Technician name': 'اسم الفني',
  Status: 'الحالة',
  Notes: 'ملاحظات',
  'Invoice (PDF)': 'الفاتورة (PDF)',
  Invoice: 'الفاتورة',
  Unassigned: 'غير مُسند',
  'Map link (Google Maps)': 'رابط الموقع (خرائط جوجل)',
  'Paste a Google Maps link — Waze link is made automatically':
    'الصق رابط خرائط جوجل — يتم إنشاء رابط ويز تلقائياً',
  'Google Maps': 'خرائط جوجل',
  Waze: 'ويز',
  Added: 'أُضيف',
  'Last edited': 'آخر تعديل',
  'Drag jobs here': 'اسحب الأعمال هنا',
  'Search customer, installer, address…': 'ابحث بالزبون أو الفني أو العنوان…',
  All: 'الكل',
  Installs: 'التركيبات',
  Repairs: 'الصيانة',

  // ---- Admin: settings ----
  'Store name': 'اسم المتجر',
  'Contact email': 'البريد الإلكتروني للتواصل',
  'Support phone': 'هاتف الدعم',
  'Default currency': 'العملة الافتراضية',
  'Save settings': 'حفظ الإعدادات',
  'Reset to defaults': 'استعادة الافتراضيات',
  'Use default': 'استخدام الافتراضي',
  Default: 'افتراضي',
  Images: 'الصور',
  'Homepage hero image': 'صورة الواجهة الرئيسية',
  'Homepage solar banner image': 'صورة بانر الطاقة الشمسية',
  'Logo (navbar)': 'الشعار (الشريط العلوي)',
  Language: 'اللغة',
  English: 'English',
  Arabic: 'العربية',
  Storefront: 'الواجهة',
  'Site-wide configuration. Some settings affect the public site immediately.':
    'إعدادات عامة للموقع. بعضها يؤثر على الموقع فوراً.',
  'When off, customers can still browse but not complete an order.':
    'عند الإيقاف، يمكن للزبائن التصفح لكن لا يمكنهم إكمال الطلب.',
  'Show the Solar Prices page link in the site navigation.':
    'إظهار رابط صفحة أسعار الطاقة الشمسية في قائمة الموقع.',
  'Show a maintenance banner; checkout will be disabled.':
    'إظهار شريط الصيانة؛ سيتم تعطيل الشراء.',
  'Group products inside a category — for example Laptops, Desktops and Printers under Computers. One per line; staff pick from these when editing a product, and shoppers can filter by them.':
    'قسّم المنتجات داخل الفئة — مثل اللابتوبات والحواسيب المكتبية والطابعات ضمن الحواسيب. واحدة في كل سطر؛ يختار منها الموظفون عند تعديل المنتج، ويستطيع الزبائن التصفية بها.',
  'Replace the main images used across the website. Changes go live as soon as you save.':
    'استبدل الصور الرئيسية المستخدمة في الموقع. تظهر التغييرات فور الحفظ.',
  'Reset all settings to defaults?': 'إعادة كل الإعدادات إلى الوضع الافتراضي؟',
  'sub-categories': 'الفئات الفرعية',
  'category tile logo': 'شعار بطاقة الفئة',
  'brand strip logo': 'شعار شريط الماركات',
  'Choose an image': 'اختر صورة',
  '…or paste an image URL': '…أو الصق رابط صورة',
  'in this list': 'في هذه القائمة',
  Installers: 'الفنيون',
  Unnamed: 'بدون اسم',
  'Site behaviour': 'سلوك الموقع',
  'Team & roles': 'الفريق والصلاحيات',
  'Site images': 'صور الموقع',
  'Default currency (ISO)': 'العملة الافتراضية (ISO)',
  'Tax rate (%)': 'نسبة الضريبة (%)',
  'Flat shipping cost': 'كلفة شحن ثابتة',
  'Enable checkout': 'تفعيل الشراء',
  'Show solar prices link': 'إظهار رابط أسعار الطاقة',
  'Maintenance mode': 'وضع الصيانة',
  'Top-of-page banner message': 'رسالة الشريط العلوي',
  'Admins — full access': 'المدراء — صلاحية كاملة',
  'Computer staff — computers & cameras': 'موظفو الحاسبات — الحاسبات والكاميرات',
  'Solar staff — solar products, prices & jobs': 'موظفو الطاقة — المنتجات والأسعار والأعمال',
  'Tiandy logo (homepage camera section)': 'شعار تياندي (قسم الكاميرات)',
  'SolarMax logo (homepage solar section)': 'شعار SolarMax (قسم الطاقة الشمسية)',
  'Settings saved.': 'تم حفظ الإعدادات.',
  Role: 'الصلاحية',
  Customer: 'زبون',
  'Full staff — computers, cameras & solar': 'موظف كامل — حاسبات وكاميرات وطاقة',
  'Admin — full access': 'مدير — صلاحية كاملة',
  'Computer staff — computers & cameras ': 'موظف حاسبات — حاسبات وكاميرات',
  'No images uploaded yet.': 'لم يتم رفع أي صور بعد.',
  'Every image uploaded to your store.': 'كل الصور المرفوعة إلى متجرك.',
  'images': 'صور',
  'in use': 'قيد الاستخدام',
  'unused': 'غير مستخدم',
  'Delete selected': 'حذف المحدد',
  'Select all shown': 'تحديد كل الظاهر',
  'Clear selection': 'إلغاء التحديد',
  'Checkout unavailable': 'الشراء غير متاح',
  'Your cart is empty': 'سلتك فارغة',

  // ---- About page ----
  'About us': 'من نحن',
  'Computers since 1992. Powering homes since 2017.':
    'حاسبات منذ 1992. ونضيء البيوت منذ 2017.',
  'Al-Waidh Technology Trading Co. LLC — founded as Al-Waidh Computers Bureau in 1992 — is one of Iraq’s leading suppliers of computers, solar energy systems, and power protection. We supply, install, and service, from a single laptop to a complete solar plant.':
    'شركة الواعظ للتكنولوجيا للتجارة المحدودة — تأسست كمكتب الواعظ للحاسبات عام 1992 — من الشركات الرائدة في العراق لتجهيز الحاسبات وأنظمة الطاقة الشمسية وحماية الطاقة. نجهّز ونركّب ونصلّح، من حاسبة واحدة إلى منظومة شمسية متكاملة.',
  'In business since': 'في السوق منذ',
  'Solar since': 'الطاقة الشمسية منذ',
  'Showrooms in Baghdad': 'صالات عرض في بغداد',
  Coverage: 'التغطية',
  'All Iraq': 'كل العراق',
  'Who we are': 'من نحن',
  'Formerly Al-Waidh Computers, today Al-Waidh Technology for Computers and Solar Systems Trading Co. LLC (Baghdad, licence no. 25460). Our main showroom is on Sinaa Street beside the University of Technology, with two further showrooms, our own service lab for computers and solar inverters, and a 600 m² warehouse in Sufaraniya.':
    'سابقاً الواعظ للحاسبات، واليوم شركة الواعظ للتكنولوجيا لتجارة الحاسبات والأنظمة الشمسية المحدودة (بغداد، إجازة رقم 25460). صالتنا الرئيسية في شارع الصناعة قرب الجامعة التكنولوجية، إضافة إلى صالتي عرض أخريين، ومختبر صيانة خاص بنا للحاسبات والعاكسات الشمسية، ومخزن بمساحة 600 م² في حي السفارانية.',
  'What we supply': 'ما نجهّزه',
  'Laptops, desktops and all-in-ones with their accessories — printers, scanners and POS systems. Solar panels, inverters and batteries. UPS units from 1 kVA up to 4 MVA, voltage stabilisers, and Tiandy security cameras and NVRs.':
    'لابتوبات وحاسبات مكتبية وحاسبات متكاملة مع ملحقاتها — طابعات وسكانرات وأنظمة نقاط بيع. ألواح شمسية وعاكسات وبطاريات. أجهزة UPS من 1 كيلوفولت أمبير حتى 4 ميغافولت أمبير، ومنظمات فولتية، وكاميرات مراقبة تياندي وأجهزة تسجيل.',
  'We install and service': 'نركّب ونصلّح',
  "We don't just sell boxes. We size and install complete solar systems and power protection, and repair what we supply in our own lab — including work such as the solar energy system at Al-Bilal station in Karbala.":
    'لا نبيع صناديق فقط. نحسب ونركّب منظومات شمسية متكاملة وأنظمة حماية الطاقة، ونصلّح ما نجهّزه في مختبرنا الخاص — ومن أعمالنا منظومة الطاقة الشمسية لمحطة البلال في كربلاء.',
  'Where we reach': 'أين نصل',
  'We wholesale computers and power equipment across every Iraqi province, from the Kurdistan Region in the north to Basrah in the south, and sell retail through our Baghdad showrooms and online with delivery.':
    'نبيع بالجملة الحاسبات ومعدات الطاقة في جميع المحافظات العراقية، من إقليم كردستان شمالاً إلى البصرة جنوباً، ونبيع بالمفرد عبر صالاتنا في بغداد وأونلاين مع التوصيل.',
  'Brands we represent': 'الوكالات التي نمثلها',
  "Iraq's first Lenovo distributor, since 2010. Distributor for Jinko Solar panels and SolarMax inverters, exclusive distributor for GE UPS (Switzerland) and for Indian low-frequency inverters, and an authorised Tiandy reseller for security cameras.":
    'أول موزّع لـ Lenovo في العراق منذ 2010. موزّع ألواح Jinko Solar وعاكسات SolarMax، وموزّع حصري لـ GE UPS (سويسرا) وللعاكسات الهندية ذات التردد الواطئ، ووكيل معتمد لكاميرات تياندي.',
  'We supply and support these brands across Iraq.':
    'نجهّز وندعم هذه العلامات في عموم العراق.',
  'Solar energy': 'الطاقة الشمسية',
  'Power protection': 'حماية الطاقة',
  'Security cameras': 'كاميرات المراقبة',
  "Have a question or want a quote? Send us a message and we'll get back to you.":
    'عندك سؤال أو تريد عرض سعر؟ أرسل لنا رسالة وسنعاود الاتصال بك.',
  Showroom: 'صالة العرض',
  Hours: 'أوقات الدوام',
  'Sinaa Street, Baghdad, Iraq': 'شارع الصناعة، بغداد، العراق',
  'Saturday – Thursday, 8:30 AM – 3:30 PM': 'السبت – الخميس، 8:30 صباحاً – 3:30 مساءً',
};

interface LanguageValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  /** Translate a string; unknown text is returned unchanged (English). */
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageValue>({
  lang: 'en',
  dir: 'ltr',
  setLang: () => {},
  t: (s) => s,
});

function readInitial(): Lang {
  try {
    return localStorage.getItem(LS_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readInitial);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch {
      /* private mode — the choice just won't persist */
    }
  }, [lang]);

  const value = useMemo<LanguageValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      setLang,
      t: (text: string) => (lang === 'ar' ? (AR[text] ?? text) : text),
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** `const { t, lang, setLang } = useLang();` */
export function useLang(): LanguageValue {
  return useContext(LanguageContext);
}
