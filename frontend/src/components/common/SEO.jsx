import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, name, type, image, url }) => {
    const siteTitle = "Teama AI";
    const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
    const defaultDescription = "Supercharge Remote Productivity with AI. Stay aligned, detect blockers, and summarize meetings.";
    const metaDescription = description || defaultDescription;
    const defaultImage = "/logo.png";
    const metaImage = image || defaultImage;
    const metaUrl = url || "https://teama.ai";

    return (
        <Helmet>
            {/* Standard metadata tags */}
            <title>{fullTitle}</title>
            <meta name='description' content={metaDescription} />
            
            {/* End standard metadata tags */}
            {/* Facebook tags */}
            <meta property="og:type" content={type || "website"} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:image" content={metaImage} />
            <meta property="og:url" content={metaUrl} />
            {/* End Facebook tags */}
            {/* Twitter tags */}
            <meta name="twitter:creator" content={name || siteTitle} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={metaImage} />
            {/* End Twitter tags */}
        </Helmet>
    );
};

export default SEO;
