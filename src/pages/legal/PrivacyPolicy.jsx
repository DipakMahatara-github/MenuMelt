import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="privacy-policy">
      <button className="privacy-back-btn" onClick={() => navigate('/')}>
        &larr; Back to Home
      </button>
      
      <h1>Privacy Policy</h1>
      <p className="last-updated">Last Updated: April 19, 2026</p>

      <section>
        <p>
          Welcome to MenuMelt. We are committed to protecting your personal information and your right to privacy. 
          If you have any questions or concerns about our policy, or our practices with regards to your personal 
          information, please contact us.
        </p>
      </section>

      <section>
        <h2>1. Information We Collect</h2>
        <p>We collect personal information that you voluntarily provide to us when you register on the platform, express an interest in obtaining information about us or our services, or otherwise when you contact us.</p>
        
        <h3>Restaurant Information</h3>
        <ul>
          <li><strong>Account Data:</strong> We collect your business name, email address, and account credentials.</li>
          <li><strong>Financial Data:</strong> We store your Khalti API credentials (encrypted) to facilitate payment processing for your customers and your subscriptions.</li>
        </ul>

        <h3>Customer & Order Information</h3>
        <ul>
          <li><strong>Order Data:</strong> We collect order details, table assignments, and session identifiers to facilitate the ordering process.</li>
          <li><strong>Usage Data:</strong> We may collect IP addresses and browser information for security and to prevent fraudulent activities.</li>
        </ul>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect or receive:</p>
        <ul>
          <li><strong>To facilitate account creation and logon process.</strong></li>
          <li><strong>To manage orders:</strong> Your information is used to route orders from customers to the kitchen and for billing.</li>
          <li><strong>To process payments:</strong> We use your information to facilitate payments via third-party processors like Khalti.</li>
          <li><strong>To send administrative information:</strong> We may use your personal information to send you product, service, and new feature information.</li>
        </ul>
      </section>

      <section>
        <h2>3. Will Your Information Be Shared With Anyone?</h2>
        <p>
          We only share information with your consent, to comply with laws, to provide you with services, to protect 
          your rights, or to fulfill business obligations. This includes sharing data with <strong>Khalti</strong> 
          for payment verification and processing.
        </p>
      </section>

      <section>
        <h2>4. Data Security</h2>
        <p>
          We have implemented appropriate technical and organizational security measures designed to protect the 
          security of any personal information we process. For example, all restaurant Secret Keys are stored 
          using industry-standard encryption.
        </p>
      </section>

      <section>
        <h2>5. Your Privacy Rights</h2>
        <p>
          You may review, change, or terminate your account at any time. If you wish to request the deletion of 
          your data, please contact our support team.
        </p>
      </section>

      <section>
        <h2>6. Contact Us</h2>
        <p>
          If you have questions or comments about this policy, you may email us at <strong>support@menumelt.com</strong>.
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
