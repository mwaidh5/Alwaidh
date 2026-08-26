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
  Computers: 'الحاسبات',
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
    'مساعدة حقيقية في اختيار أنظمة الطاقة والحاسبات والمراقبة — قبل الشراء وبعده.',

  // ---- Homepage ----
  'New arrivals': 'وصل حديثاً',
  'Clean energy': 'طاقة نظيفة',
  Surveillance: 'المراقبة والحماية',
  'Laptops built for real work': 'حواسيب محمولة للعمل الحقيقي',
  'Cut your power bill for good': 'خفّض فاتورة الكهرباء إلى الأبد',
  'Tiandy cameras, properly installed': 'كاميرات تياندي بتركيب احترافي',
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
  'Shop computers': 'تسوّق الحاسبات',
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
  '12-month warranty': 'كفالة 12 شهراً',
  'On every computer and camera we sell.': 'على كل حاسوب وكاميرا نبيعها.',
  'Same-day dispatch on in-stock items in Baghdad.':
    'شحن في نفس اليوم للمنتجات المتوفرة داخل بغداد.',
  'Installed by our crew': 'تركيب بفريقنا',
  'Solar and CCTV, never subcontracted.': 'الطاقة الشمسية والمراقبة، بدون مقاولين من الباطن.',
  'Repairs in-house': 'صيانة داخلية',
  'Diagnostics within 48 hours.': 'فحص وتشخيص خلال 48 ساعة.',
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
  'e.g. Baghdad — Karrada': 'مثال: بغداد — الكرادة',
  'How many amperes do you need?': 'كم أمبير تحتاج؟',
  'e.g. 20 A': 'مثال: 20 أمبير',
  Baghdad: 'بغداد',
  Basra: 'البصرة',
  Erbil: 'أربيل',
  Mosul: 'الموصل',
  Najaf: 'النجف',
  'Average monthly bill': 'معدل الفاتورة الشهرية',
  'Select a range': 'اختر النطاق',
  'Under 50,000 IQD': 'أقل من 50,000 د.ع',
  '50,000 – 150,000 IQD': '50,000 – 150,000 د.ع',
  'Over 150,000 IQD': 'أكثر من 150,000 د.ع',
  'Request a free site visit': 'اطلب زيارة موقعية مجانية',
  'Sending…': 'جاري الإرسال…',
  'We’ll call you within 24 hours. No obligation.': 'سنتصل بك خلال 24 ساعة. بدون أي التزام.',
  'Thanks — we’ll call you within 24 hours.': 'شكراً — سنتصل بك خلال 24 ساعة.',
  'Please add your name and phone number.': 'الرجاء إضافة اسمك ورقم هاتفك.',

  // ---- Product & shop ----
  'Add to cart': 'أضف إلى السلة',
  'You save': 'توفير',
  'Was price (leave empty if not on offer)': 'السعر السابق (اتركه فارغاً إن لم يكن هناك عرض)',
  'The old price, shown crossed out': 'السعر القديم، يظهر مشطوباً',
  'Shows as': 'يظهر كـ',
  'The was price has to be higher than the price to show a discount.':
    'يجب أن يكون السعر السابق أعلى من السعر الحالي حتى يظهر الخصم.',
  'How photos are shown': 'طريقة عرض الصور',
  'Show the whole photo (nothing cut off)': 'إظهار الصورة كاملة (بدون قص)',
  'Fill the frame (edges may be cut off)': 'ملء الإطار (قد تُقص الحواف)',
  'Photos that are not square get cut off when they fill the frame — that is what makes some look zoomed in.':
    'الصور غير المربعة تُقص عند ملء الإطار — وهذا ما يجعل بعضها تبدو مكبّرة.',
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
  'Touch up': 'تنقيح',
  'Rub out': 'مسح',
  'Bring back': 'إرجاع',
  'Draw around': 'تحديد بالرسم',
  'Click a colour': 'اختر لوناً',
  'Brush size': 'حجم الفرشاة',
  'How similar': 'درجة التشابه',
  'Delete inside': 'حذف الداخل',
  'Keep only this': 'إبقاء هذا فقط',
  Undo: 'تراجع',
  Done: 'تم',
  'Drag over what you want gone.': 'مرّر فوق ما تريد إزالته.',
  'Drag to paint the picture back.': 'مرّر لإعادة رسم الصورة.',
  'Draw a loop, then choose what happens to it.': 'ارسم حلقة ثم اختر ما تريد فعله بها.',
  'Click a colour to drop it — the slider widens the match.':
    'اضغط على لون لإزالته — المؤشر يوسّع نطاق التشابه.',
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

  // ---- Homepage banners (settings) ----
  'Homepage banners': 'بانرات الصفحة الرئيسية',
  'Each banner is a photo with wording and a button over it. Tap one to change its words, colours and where the button goes.':
    'كل بانر عبارة عن صورة مع نص وزر فوقها. اضغط على أي واحد لتغيير كلماته وألوانه ووجهة الزر.',
  'The big banners at the top of the homepage.': 'البانرات الكبيرة أعلى الصفحة الرئيسية.',
  'Shop name, contact details and currency.': 'اسم المتجر وبيانات التواصل والعملة.',
  'Tax, delivery fee and whether customers can order.':
    'الضريبة وأجور التوصيل وإمكانية الطلب للزبائن.',
  'Maintenance mode and the announcement bar.': 'وضع الصيانة وشريط الإعلانات.',
  'The groups staff can file products under.': 'المجموعات التي يصنّف الموظفون المنتجات ضمنها.',
  'Logo, category tiles and brand logos.': 'الشعار وبطاقات الفئات وشعارات الماركات.',
  Banner: 'بانر',
  'Homepage tiles': 'بطاقات الصفحة الرئيسية',
  'The three smaller cards under the main banner.': 'البطاقات الثلاث الأصغر تحت البانر الرئيسي.',
  'Tap a tile to change its photo, its wording, its colours and where it leads.':
    'اضغط على بطاقة لتغيير صورتها ونصها وألوانها ووجهتها.',
  Tile: 'بطاقة',
  Untitled: 'بدون عنوان',
  'Tile photo': 'صورة البطاقة',
  'Tile goes to': 'وجهة البطاقة',
  Title: 'العنوان',
  '+ Add a tile': '+ إضافة بطاقة',
  'Remove this tile': 'حذف هذه البطاقة',
  'Brand logos': 'شعارات الماركات',
  'App version': 'إصدار التطبيق',
  'Force a device onto the newest version of the site.': 'إجبار الجهاز على أحدث نسخة من الموقع.',
  'This device is running the version below. If a phone or computer is showing something old, open this page there and press the button — it throws away the stored copy and downloads the newest one.':
    'هذا الجهاز يعمل بالإصدار أدناه. إذا كان هاتف أو حاسوب يعرض نسخة قديمة، افتح هذه الصفحة عليه واضغط الزر — سيحذف النسخة المخزّنة وينزّل الأحدث.',
  Version: 'الإصدار',
  'Clear cache and reload': 'مسح الذاكرة المؤقتة وإعادة التحميل',
  'Clearing…': 'جاري المسح…',
  'Cleared. Reloading…': 'تم المسح. جاري إعادة التحميل…',
  'The brands strip on the homepage.': 'شريط الماركات في الصفحة الرئيسية.',
  'Add the brands you carry, upload each logo, and reorder or remove them.':
    'أضف الماركات التي توفّرها، وارفع شعار كل واحدة، ورتّبها أو احذفها.',
  'Brand name': 'اسم الماركة',
  'No logo': 'لا يوجد شعار',
  Logo: 'الشعار',
  '+ Add a brand': '+ إضافة ماركة',
  'Remove this brand': 'حذف هذه الماركة',
  'Move up': 'تحريك للأعلى',
  'Move down': 'تحريك للأسفل',
  'Remove this banner': 'حذف هذا البانر',
  '+ Add a banner': '+ إضافة بانر',
  'Banner photo (computer — wide)': 'صورة البانر (للحاسوب — عريضة)',
  'Banner photo for phones (tall — optional)': 'صورة البانر للهواتف (طولية — اختيارية)',
  'On a phone the banner is taller than it is wide, so a wide photo loses its sides. Upload a tall version here — about 720 × 880 — or leave it empty to crop the wide one.':
    'على الهاتف يكون البانر أطول من عرضه، لذا تفقد الصورة العريضة جوانبها. ارفع نسخة طولية هنا — بحدود 720 × 880 — أو اتركها فارغة ليتم قص الصورة العريضة.',
  'Your headline here': 'العنوان هنا',
  '🖥️ Computer': '🖥️ حاسوب',
  '📱 Phone': '📱 هاتف',
  'No phone photo yet — the wide one is being cropped to fit.':
    'لا توجد صورة للهاتف بعد — يتم قص الصورة العريضة لتناسب المساحة.',
  'Small label above the headline': 'نص صغير فوق العنوان',
  'e.g. New arrivals': 'مثال: وصل حديثاً',
  Headline: 'العنوان',
  'Sentence under the headline': 'جملة تحت العنوان',
  'Button text': 'نص الزر',
  'Leave empty to hide the button': 'اتركه فارغاً لإخفاء الزر',
  'Button goes to': 'وجهة الزر',
  'Text colour': 'لون النص',
  'Button colour': 'لون الزر',
  'Button text colour': 'لون نص الزر',
  'Darken photo': 'تعتيم الصورة',

  // ---- Contact form ----
  'Thanks — we received your message.': 'شكراً — استلمنا رسالتك.',
  "We'll be in touch shortly.": 'سنتواصل معك قريباً.',
  'Send another message': 'إرسال رسالة أخرى',

  // ---- Admin: jobs (leftovers) ----
  Showing: 'عرض',
  of: 'من',
  jobs: 'عمل',
  'Waze link will be created automatically from this': 'سيتم إنشاء رابط Waze تلقائياً من هذا',
  'No installers yet — add one under Users, with the role “Installer”.':
    'لا يوجد فنيون بعد — أضف واحداً من صفحة المستخدمين بدور «فني».',
  'Currently written down as': 'مسجَّل حالياً باسم',
  'Drag & drop a PDF invoice here, or click to choose':
    'اسحب وأفلت فاتورة PDF هنا، أو اضغط للاختيار',
  'Invoice preview': 'معاينة الفاتورة',
  'Open in new tab': 'فتح في تبويب جديد',

  // ---- View as ----
  'Viewing the dashboard as': 'تعرض لوحة التحكم كـ',
  'Anything you do is still recorded as you.': 'أي إجراء تقوم به يُسجَّل باسمك أنت.',
  'Back to my own view': 'العودة إلى عرضي',

  // ---- Analytics ----
  'How visitors are using the site and where they came from.':
    'كيف يستخدم الزوار الموقع ومن أين جاؤوا.',
  'Open Google Analytics': 'فتح Google Analytics',
  Today: 'اليوم',
  'Last 7 days': 'آخر 7 أيام',
  'Last 30 days': 'آخر 30 يوماً',
  'All time': 'كل الفترات',
  'views in this period': 'مشاهدة في هذه الفترة',
  'Page views': 'مشاهدات الصفحات',
  Visitors: 'الزوار',
  'Busiest day': 'أكثر يوم ازدحاماً',
  'Views by day': 'المشاهدات حسب اليوم',
  'Where visitors came from': 'من أين جاء الزوار',
  'Most viewed pages': 'الصفحات الأكثر مشاهدة',
  'Recent activity': 'النشاط الأخير',
  'No page views in this period.': 'لا توجد مشاهدات في هذه الفترة.',
  'No traffic in this period.': 'لا توجد زيارات في هذه الفترة.',
  'Nothing in this period.': 'لا شيء في هذه الفترة.',
  When: 'الوقت',
  Page: 'الصفحة',
  Source: 'المصدر',

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
  'These settings apply to this browser only.': 'هذه الإعدادات تخص هذا المتصفح فقط.',
  'In this browser, notifications only arrive while a dashboard tab is open.':
    'في هذا المتصفح، تصل الإشعارات فقط ما دامت لوحة التحكم مفتوحة في تبويب.',
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
    'قسّم المنتجات داخل الفئة — مثل اللابتوبات والحاسبات المكتبية والطابعات ضمن الحاسبات. واحدة في كل سطر؛ يختار منها الموظفون عند تعديل المنتج، ويستطيع الزبائن التصفية بها.',
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

  // ---- Sharing a product ----
  Share: 'مشاركة',
  'Share this product': 'شارك هذا المنتج',
  'Link copied ✓': 'تم نسخ الرابط ✓',
  'Could not copy': 'تعذّر النسخ',

  // ---- Shared files ----
  Files: 'الملفات',
  'Catalogues, price lists and other documents — shared with everyone who works here.':
    'الكتالوجات وقوائم الأسعار والمستندات الأخرى — متاحة لكل من يعمل هنا.',
  'Search files…': 'ابحث في الملفات…',
  'Nothing here yet — upload a catalogue to get started.':
    'لا يوجد شيء بعد — ارفع كتالوجاً للبدء.',
  'No files match that search.': 'لا توجد ملفات مطابقة للبحث.',
  'Added by': 'أضافه',
  View: 'عرض',
  Download: 'تنزيل',
  'Copied ✓': 'تم النسخ ✓',
  'Remove this file for everyone?': 'إزالة هذا الملف للجميع؟',
  'Could not remove the file.': 'تعذّر حذف الملف.',
  'or drop a file here — PDF up to 25 MB':
    'أو أفلت ملفاً هنا — PDF لغاية 25 ميغابايت',
  'Note (optional)': 'ملاحظة (اختياري)',
  'e.g. 2026 price list': 'مثال: قائمة أسعار 2026',
  'Uploaded ✓': 'تم الرفع ✓',
  'Upload failed.': 'فشل الرفع.',
  'This file type opens outside the dashboard — use Download.':
    'يُفتح هذا النوع خارج لوحة التحكم — استخدم تنزيل.',

  // ---- Photo tools ----
  'Snap to edges': 'التصاق بالحواف',
  'Trace around the edge — the line sticks to it as you go.':
    'ارسم حول الحافة — يلتصق الخط بها أثناء الرسم.',
  'Back to original': 'العودة إلى الأصل',
  'Putting it back…': 'جاري الإرجاع…',
  'Put the original photo back? Your edits to it will be lost.':
    'إرجاع الصورة الأصلية؟ ستفقد التعديلات التي أجريتها عليها.',

  // ---- Account email links ----
  'One moment…': 'لحظة من فضلك…',
  'Checking your link…': 'جاري التحقق من الرابط…',
  'Email confirmed': 'تم تأكيد البريد',
  'Your email address is confirmed. Everything is ready to use.':
    'تم تأكيد بريدك الإلكتروني. كل شيء جاهز للاستخدام.',
  'Password changed': 'تم تغيير كلمة المرور',
  'You can sign in with your new password now.':
    'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
  'Choose a new password': 'اختر كلمة مرور جديدة',
  'New password': 'كلمة المرور الجديدة',
  'Repeat it': 'أعد كتابتها',
  'Save new password': 'حفظ كلمة المرور',
  For: 'لحساب',
  'Use at least 6 characters.': 'استخدم 6 أحرف على الأقل.',
  'The two passwords are different.': 'كلمتا المرور غير متطابقتين.',
  'This link no longer works': 'هذا الرابط لم يعد يعمل',
  'This link has already been used, or a newer email replaced it.':
    'تم استخدام هذا الرابط من قبل، أو وصلت رسالة أحدث ألغته.',
  'This link is missing something. Open the newest email and try again.':
    'الرابط غير مكتمل. افتح أحدث رسالة وحاول مرة أخرى.',
  "This link isn't one we recognise.": 'هذا الرابط غير معروف لدينا.',
  'This account has been turned off.': 'تم إيقاف هذا الحساب.',
  'That account no longer exists.': 'لم يعد هذا الحساب موجوداً.',
  'Something went wrong. Please try again.': 'حدث خطأ ما. حاول مرة أخرى.',
  'Each link works once. Asking for another email cancels the one before it, so only the newest email opens — and a link already opened once will say this the second time, even though it worked.':
    'كل رابط يعمل مرة واحدة. طلب رسالة جديدة يلغي الرسالة السابقة، لذا تعمل أحدث رسالة فقط — والرابط الذي فُتح مرة سيظهر هذه الرسالة في المرة الثانية رغم أنه نجح.',
  'Try signing in': 'جرّب تسجيل الدخول',
  'Send me a new link': 'أرسل لي رابطاً جديداً',
  'Sent. Open the newest email — older ones no longer work.':
    'تم الإرسال. افتح أحدث رسالة — الرسائل الأقدم لم تعد تعمل.',
  'Could not send another email just now. Try again in a minute.':
    'تعذّر إرسال رسالة أخرى الآن. حاول بعد دقيقة.',
  // ---- Solar jobs on a phone ----
  'Nothing here.': 'لا يوجد شيء هنا.',
  'Has an invoice': 'يحتوي على فاتورة',
  // ---- Phone tab bar ----
  Solar: 'الطاقة',
  Account: 'حسابي',
  // ---- Pull to refresh ----
  'Pull to refresh': 'اسحب للتحديث',
  'Let go to refresh': 'أفلت للتحديث',
  'Refreshing…': 'جاري التحديث…',
  // ---- Dashboard menu on a phone ----
  Work: 'العمل',
  Team: 'الفريق',
  Manage: 'الإدارة',
  'The shop': 'المتجر',
  // ---- What changed since you last looked ----
  New: 'جديد',
  'Changed since you last opened it': 'تغيّر منذ آخر مرة فتحته',
  'Something here changed since you last looked': 'حدث تغيير هنا منذ آخر مرة نظرت',
  // ---- The homepage solar scene ----
  panels: 'ألواح',
  'Drag the worker, or tap the roof': 'اسحب العامل، أو اضغط على السطح',
  'Roof done — your house next?': 'اكتمل السطح — بيتك التالي؟',
  'An installer mounting solar panels on a flat roof':
    'فنّي يركّب ألواحاً شمسية على سطح منزل',
  'Forget your electricity problems —': 'انسَ مشاكل الكهرباء —',
  'live without power cuts': 'وعِش من دون انقطاع',
  'See solar prices': 'اطّلع على أسعار الطاقة الشمسية',
  // ---- Start here / promo cards (from the canvas design) ----
  'Start here': 'ابدأ من هنا',
  'What do you need it for?': 'ما الذي تحتاجه؟',
  'Home office': 'مكتب منزلي',
  'Setting up to work': 'تجهيز مكان عملك',
  'A laptop, monitor and the cables that fit it.': 'حاسبة وشاشة والكيبلات المناسبة لها.',
  'See bundles': 'شاهد الحزم',
  'Power cuts': 'انقطاع الكهرباء',
  'Keeping the lights on': 'إبقاء الكهرباء مستمرة',
  'Tell us what must stay running and we size it.': 'أخبرنا بما يجب أن يبقى يعمل ونحدّد حجم النظام.',
  'Size my system': 'حدّد نظامي',
  'Watching the shop': 'مراقبة متجرك',
  'Cameras, recorder and cabling from your plan.': 'كاميرات ومسجّل وتمديدات حسب مخططك.',
  'Plan a system': 'خطّط نظامك',
  'Business': 'للشركات',
  'Buying wholesale': 'الشراء بالجملة',
  'Quantity pricing to every Iraqi province.': 'أسعار بالكمية لكل محافظات العراق.',
  'Request pricing': 'اطلب عرض سعر',
  'Panels, inverters and batteries for clean, reliable power.': 'ألواح وإنفرترات وبطاريات لطاقة نظيفة وموثوقة.',
  'Authorised reseller': 'موزّع معتمد',
  'IP and analog cameras and NVRs.': 'كاميرات IP وتناظرية وأجهزة NVR.',
  'Since 1992': 'منذ 1992',
  'Laptops, desktops and workstations.': 'حاسبات محمولة ومكتبية ومحطات عمل.',
  // ---- The solar prices page (from the canvas design) ----
  'System prices': 'أسعار المنظومات',
  'Solar power systems': 'منظومات الطاقة الشمسية',
  'Complete prices including panels, inverter, batteries and installation. Prices are in Iraqi dinar and can change with stock.':
    'أسعار كاملة تشمل الألواح، العاكسة، البطاريات والتركيب. الأسعار بالدينار العراقي وقابلة للتغيير حسب توفر المواد.',
  'Ask about this system': 'استفسر عن المنظومة',
  'For enquiries and installation:': 'للاستفسار والتركيب:',
  'Request a quote': 'اطلب عرض سعر',
  Amp: 'أمبير',
  'Download PDF': 'تنزيل PDF',
  'Preparing…': 'جاري التحضير…',
  'Choose your system': 'اختر منظومتك',
  'Ready systems by consumption size — the price includes panels, inverter, batteries and installation.':
    'أنظمة جاهزة بحسب حجم الاستهلاك — السعر يشمل الألواح والعاكسة والبطاريات والتركيب.',
  'Most requested': 'الأكثر طلباً',
  // ---- About page (from the canvas design) ----
  'One company,': 'شركة واحدة،',
  'three trades we know cold.': 'وثلاثة اختصاصات نتقنها.',
  'Al-Waidh Technology Trading Co. LLC started as a computer bureau in Baghdad in 1992. Today we supply, install and service three things — and we do all three ourselves, from a single laptop to a complete solar plant.':
    'بدأت شركة الواعظ للتجارة والتكنولوجيا كمكتب حاسبات في بغداد عام 1992. اليوم نوفّر ونركّب ونصون ثلاثة اختصاصات — وننفّذها كلها بأنفسنا، من حاسبة واحدة إلى محطة طاقة شمسية كاملة.',
  'Provinces we deliver to': 'محافظة نوصل إليها',
  'What we do': 'ماذا نعمل',
  'Three identities, one team': 'ثلاث هويات، فريق واحد',
  'Each line has its own stock, its own engineers and its own warranty — and they all come out of the same showroom on Sinaa Street.':
    'لكل اختصاص مخزونه ومهندسوه وضمانه الخاص — وكلها تخرج من نفس الصالة في شارع الصناعة.',
  'Since 2017': 'منذ 2017',
  '01 — Computers': '01 — الحاسبات',
  '02 — Solar energy': '02 — الطاقة الشمسية',
  '03 — Security cameras': '03 — كاميرات المراقبة',
  'Machines that hold up at work': 'أجهزة تصمد في العمل',
  'Power that stays on': 'كهرباء لا تنقطع',
  'Eyes on the whole site': 'عين على الموقع بالكامل',
  "Laptops, desktops and all-in-ones with the accessories that go with them — printers, scanners and POS systems. Iraq's first Lenovo distributor since 2010.":
    'حاسبات محمولة ومكتبية وأجهزة متكاملة مع ملحقاتها — طابعات وماسحات وأنظمة نقاط بيع. أول موزّع لِـ Lenovo في العراق منذ 2010.',
  'Panels, hybrid inverters and batteries sized to your actual load — plus UPS from 1 kVA to 4 MVA and voltage stabilisers. We built the solar system at Al-Bilal station in Karbala.':
    'ألواح وإنفرترات هجينة وبطاريات بحجم يناسب أحمالك الفعلية — إضافة إلى UPS من 1 كيلوفولت أمبير حتى 4 ميغا ومنظّمات فولتية. نفّذنا نظام الطاقة الشمسية في محطة البلال في كربلاء.',
  'Tiandy IP and analog cameras, NVRs and full-site coverage — planned from your floor plan, cabled and commissioned by our own crew.':
    'كاميرات Tiandy الشبكية والتناظرية وأجهزة NVR وتغطية كاملة للموقع — مخطّطة من مخطط موقعك، وتمديد وتشغيل بفريقنا.',
  'Supply': 'توريد',
  'Service': 'صيانة',
  'Business laptops, workstations, POS': 'حاسبات أعمال ومحطات عمل وأنظمة بيع',
  'Office roll-outs and networking': 'تجهيز المكاتب والشبكات',
  'Repairs in our own Baghdad lab': 'صيانة في مختبرنا ببغداد',
  'Jinko panels, SolarMax & GE UPS': 'ألواح Jinko وإنفرترات SolarMax و GE UPS',
  'Free survey, sized and fitted by us': 'مسح مجاني، تحديد الحجم والتركيب علينا',
  'Inverter repair in-house': 'صيانة الإنفرترات داخلياً',
  'Tiandy cameras, NVRs, PoE switches': 'كاميرات Tiandy وأجهزة NVR ومبدّلات PoE',
  'Camera plan, cabling, commissioning': 'مخطط الكاميرات والتمديد والتشغيل',
  'Remote setup and callouts': 'إعداد عن بُعد وزيارات ميدانية',
  'Behind all three': 'خلف الثلاثة',
  'The same company does the selling, the fitting and the fixing':
    'الشركة نفسها تبيع وتركّب وتصلّح',
  'Al-Waidh Technology for Computers and Solar Systems Trading Co. LLC — Baghdad, licence no. 25460.':
    'شركة الواعظ للتكنولوجيا للحاسبات وأنظمة الطاقة الشمسية المحدودة — بغداد، إجازة رقم 25460.',
  'Three showrooms': 'ثلاث صالات عرض',
  'Main one on Sinaa Street beside the University of Technology, plus two more in Baghdad.':
    'الرئيسية في شارع الصناعة بجانب الجامعة التكنولوجية، بالإضافة إلى صالتين أخريين في بغداد.',
  'Our own service lab': 'مختبر صيانة خاص بنا',
  "Computers and solar inverters repaired in-house — we don't hand your kit to anyone else.":
    'نصلّح الحاسبات والإنفرترات داخلياً — لا نسلّم أجهزتك لأي جهة أخرى.',
  '600 m² warehouse': 'مخزن 600 م²',
  'Stock held in Sufaraniya, so what you order is usually already in the country.':
    'المخزون في السفارنية، فما تطلبه غالباً موجود في البلد.',
  'Wholesale across Iraq': 'بيع بالجملة في عموم العراق',
  'Every province, Kurdistan to Basrah — and retail online with delivery.':
    'كل المحافظات، من كردستان إلى البصرة — وبيع مفرد أونلاين مع توصيل.',
  'Brands we distribute and support': 'الماركات التي نوزّعها وندعمها',
  'Contact': 'اتصل بنا',
  'Come to the showroom, or tell us what you need': 'زرنا في الصالة، أو أخبرنا بما تحتاج',
  "Quotes for solar systems and camera installs are free — send a rough idea of the site and we'll come back with a size and a price.":
    'عروض أسعار أنظمة الطاقة الشمسية وتركيب الكاميرات مجانية — أرسل وصفاً مبدئياً للموقع ونعود إليك بالحجم والسعر.',
  'Send us a message': 'أرسل لنا رسالة',
  'We reply during showroom hours, usually the same day.': 'نرد خلال أوقات الدوام، عادةً في نفس اليوم.',
  'What is it about?': 'ما موضوع الرسالة؟',
  'Solar quote': 'عرض سعر طاقة شمسية',
  'Camera install': 'تركيب كاميرات',
  'Wholesale': 'بالجملة',
  'Or call the showroom directly.': 'أو اتصل بالصالة مباشرة.',
  'Tell us about the site, the load, or the spec you need.': 'أخبرنا عن الموقع أو حجم الأحمال أو المواصفات التي تريدها.',
  'Panels, inverters and batteries for clean, reliable power — sized, installed and serviced by us.': 'ألواح وإنفرترات وبطاريات لطاقة نظيفة وموثوقة — نحدّد الحجم ونركّب ونصون بأنفسنا.',
  'Professional IP and analog cameras and NVRs.': 'كاميرات IP وتناظرية احترافية وأجهزة NVR.',
  'Laptops, desktops and workstations for work and play.': 'حاسبات محمولة ومكتبية ومحطات عمل للعمل واللعب.',
  'Small label (Arabic)': 'التسمية الصغيرة (بالعربية)',
  'Headline (Arabic)': 'العنوان (بالعربية)',
  'Sentence under the headline (Arabic)': 'الجملة تحت العنوان (بالعربية)',
  'Button text (Arabic)': 'نص الزر (بالعربية)',
  'About page — Computers photo': 'صفحة من نحن — صورة الحاسبات',
  'About page — Solar photo': 'صفحة من نحن — صورة الطاقة الشمسية',
  'About page — Cameras photo': 'صفحة من نحن — صورة الكاميرات',
  'Best sizes: about 1200 × 520 for the big solar tile, about 600 × 500 for the two side tiles. The photo fills the box, so anything extra is cropped from the edges.':
    'أفضل الأحجام: حوالي 1200 × 520 للبطاقة الشمسية الكبيرة، وحوالي 600 × 500 للبطاقتين الجانبيتين. الصورة تملأ الإطار، وما يزيد يُقص من الأطراف.',
  'Logo on the photo (top corner — optional)': 'الشعار على الصورة (الزاوية العلوية — اختياري)',
  'Shown in a small white chip pinned to the top corner of the photo, so use a clean photo without a logo baked in. A wide transparent PNG works best.':
    'يظهر داخل شارة بيضاء صغيرة مثبتة في زاوية الصورة العلوية، لذا استخدم صورة نظيفة بدون شعار مطبوع فيها. الأفضل ملف PNG عريض بخلفية شفافة.',
  'Cash prices': 'الأسعار النقدية',
  'Installments': 'التقسيط',
  'Central Bank initiative — pay monthly': 'مبادرة البنك المركزي — ادفع بالأقساط الشهرية',
  'Plan length': 'مدة التقسيط',
  'year': 'سنة',
  'years': 'سنوات',
  'Inverter': 'العاكسة',
  'Panels': 'الألواح',
  'Batteries': 'البطاريات',
  'Backup hours': 'ساعات التغذية',
  'hours': 'ساعة',
  'monthly': 'شهرياً',
  'Total price': 'السعر النهائي',
  'Cash price': 'السعر النقدي',
  'Prices include installation and commissioning. IP65 inverter with internet monitoring and a 5-year warranty; 16 KWh IP20 lithium batteries, 8000 cycles, 5-year warranty; Jinko 650W panels with a 15-year warranty.':
    'الأسعار تشمل التنصيب والتشغيل. العاكسة فئة IP65 مع مراقبة عبر الإنترنت وضمان 5 سنوات؛ بطاريات ليثيوم IP20 سعة 16 كيلو واط بعدد 8000 دورة وضمان 5 سنوات؛ ألواح Jinko قدرة 650 واط بضمان 15 سنة.',
  'See everything matching your search': 'عرض كل النتائج المطابقة لبحثك',
  'Browse all products': 'تصفح جميع المنتجات',
  'Add people': 'إضافة أشخاص',
  'Add to conversation': 'أضفهم إلى المحادثة',
  'Rename group': 'إعادة تسمية المجموعة',
  'Group name': 'اسم المجموعة',
  'Installment systems — Central Bank initiative': 'منظومات التقسيط — مبادرة البنك المركزي',
  'and every plan derive from the published 7-year total.': 'وكل الخطط محسوبة من السعر النهائي المعلن لسبع سنوات.',
  'System': 'المنظومة',
  'Monthly payment': 'القسط الشهري',
  'These prices include installation and commissioning; installation costs can vary by 10% depending on the site.':
    'هذه الأسعار تتضمن تكاليف التنصيب والتشغيل للمنظومة، ويمكن لتكاليف النصب أن تتغير بنسبة 10% حسب مكان التنصيب.',
  'The inverter is IP65-rated with internet monitoring and a 5-year warranty.':
    'الانفيرتر المستخدم من فئة IP65 ويحتوي على خاصية المراقبة عن طريق الإنترنت وبضمان 5 سنوات.',
  'The batteries are IP20-rated, 16 KWh, 8000 charge cycles at 90% depth of discharge, with a 5-year warranty.':
    'البطاريات المستخدمة من فئة IP20 سعة 16 كيلو واط بعدد 8000 دورة شحن وتفريغ وبعمق تفريغ 90% وبضمان 5 سنوات.',
  'The panels are Jinko — the world’s number one panel — rated 650W with a 15-year warranty.':
    'الألواح المستخدمة من نوع Jinko (اللوح رقم واحد عالمياً) بقدرة 650 واط وبضمان 15 سنة.',
  'AC cabling is included up to 20 metres; any extra length is charged.': 'كيبلات التيار المتناوب (AC) مشمولة حتى طول 20 متراً، وأي زيادة تكون مقابل ثمن.',
  'Every plan is calculated from the published 7-year total.':
    'كل الخطط محسوبة من السعر النهائي المعلن لسبع سنوات.',
  'Hi! I am interested in the {system} system — could you give me the details?':
    'مرحباً! أرغب بالاستفسار عن منظومة {system} — ممكن التفاصيل والسعر؟',
  'Hi! I am interested in the {system} installment system on a {years}-year plan — could you give me the details?':
    'مرحباً! أرغب بالاستفسار عن منظومة التقسيط {system} بخطة {years} سنوات — ممكن التفاصيل؟',
  'Order tracking': 'تتبع الطلب',
  'Hello': 'مرحباً',
  'Order reference': 'رقم الطلب',
  'Order not found': 'الطلب غير موجود',
  'Check the link from your confirmation email, or ask us in the chat.': 'تأكد من الرابط في رسالة التأكيد، أو اسألنا في المحادثة.',
  'This order was cancelled. If that is a surprise, talk to us and we will sort it out.':
    'تم إلغاء هذا الطلب. إذا كان ذلك مفاجئاً لك، تحدث إلينا وسنحل الأمر.',
  'Order received': 'تم استلام الطلب',
  'Payment confirmed': 'تم تأكيد الدفع',
  'On its way': 'في الطريق',
  'Delivered': 'تم التوصيل',
  'Your items': 'طلباتك',
  'Ask about this order': 'استفسر عن هذا الطلب',
  'Hi! I would like to ask about my order {ref}.': 'مرحباً! أرغب بالاستفسار عن طلبي رقم {ref}.',
  'Track your order': 'تتبع طلبك',
  "We'll be in touch shortly to confirm payment & shipping. A confirmation email with your tracking link is on its way.":
    'سنتواصل معك قريباً لتأكيد الدفع والتوصيل. أرسلنا لك رسالة تأكيد فيها رابط تتبع الطلب.',
  'Articles': 'المقالات',
  'Solar energy, explained properly': 'الطاقة الشمسية، مشروحة بشكل صحيح',
  'Prices, sizing, inverters, batteries — written by the people who install them across Iraq.':
    'الأسعار، اختيار الحجم، الانفيرترات، البطاريات — بقلم الفريق الذي يركّبها في عموم العراق.',
  'Read the article': 'اقرأ المقال',
  'Articles are on their way — check back soon.': 'المقالات في الطريق — عد قريباً.',
  'Article not found': 'المقال غير موجود',
  'All articles': 'جميع المقالات',
  'Thinking about solar for your home or business?': 'تفكر بالطاقة الشمسية لبيتك أو محلك؟',
  'See our system prices, or ask us anything — the survey is free.': 'اطلع على أسعار منظوماتنا، أو اسألنا أي شيء — الكشف مجاني.',
  'Coming soon': 'قريباً',
  'Want it? Get notified when it arrives.': 'تريده؟ سنخبرك فور توفره.',
  'Notify me': 'أخبرني',
  "You're on the list — we'll email you the moment it's available.": 'أنت على القائمة — سنرسل لك بريداً فور توفره.',
  'That did not work — check the email and try again.': 'لم ينجح الأمر — تأكد من البريد وحاول مجدداً.',
  'you@example.com': 'you@example.com',
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
